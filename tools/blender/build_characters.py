"""
Dựng 6 nhân vật thú (costume hai chân) trong Blender và xuất glTF có xương + animation.

Chạy nền:  blender -b --factory-startup --python tools/blender/build_characters.py -- public/models

Cách dựng:
  - Thân, đầu, tay chân ghép từ khối cơ bản rồi Remesh (voxel) + Smooth + Decimate
    thành MỘT lưới liền, không còn vết ghép khớp; gán vật liệu theo vùng (bụng, mặt, mõm).
  - Tai, đuôi, bàn tay, bàn chân, mũi, nanh, gạc, má là lưới riêng gắn vào xương
    để game có thể ẩn/xoay (manh mối tai lệch, tay năm ngón, giày).
  - Armature 20 xương, tự động tính trọng số; 3 action: Idle, Walk, Talk → NLA → glTF.
  - Mắt, lông mày, miệng, phụ kiện, khóa kéo được game gắn thêm vào xương lúc chạy.

Tọa độ trong file này viết theo hệ Three.js (y lên, nhân vật nhìn +z) rồi đổi sang Blender
bằng hàm T(); glTF xuất ra (Y-up) sẽ trùng với hệ Three.js.
Giữ đồng bộ bảng SPECIES với src/data/species.ts.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- Tham số loài
SPECIES = {
    'bear': dict(fur=0x6B4423, belly=0x9C7A52, snoutColor=0xC9A27E, nose=0x1A1A1A,
                 ear='round', earInner=0x9C7A52, tail='stub', snout='short'),
    'fox': dict(fur=0xE0782A, belly=0xF5EDE0, snoutColor=0xF5EDE0, nose=0x1A1A1A,
                ear='pointed', earTip=0x1A1A1A, tail='bushy', tailTip=0xF5EDE0,
                snout='long', mask=0xF5EDE0, cheeks='tufts'),
    'rabbit': dict(fur=0xEDEDED, belly=0xFFFFFF, snoutColor=0xF2B8C6, nose=0xD96A8A,
                   ear='long', earInner=0xF2B8C6, tail='puff', snout='short'),
    'boar': dict(fur=0x6E645A, belly=0x8A7F73, snoutColor=0xB08A78, nose=0x5A4038,
                 ear='small', tail='short', snout='flat', tusks=True),
    'wolf': dict(fur=0x8C8F96, belly=0xD9DBDE, snoutColor=0xD9DBDE, nose=0x1A1A1A,
                 ear='pointed', tail='long', snout='long', mask=0xD9DBDE, cheeks='tufts'),
    'deer': dict(fur=0xB98A4B, belly=0xE8D8B8, snoutColor=0xE8D8B8, nose=0x1A1A1A,
                 ear='wide', earInner=0xE8D8B8, tail='flag', tailTip=0xFFFFFF,
                 snout='medium', mask=0xE8D8B8, spots=True, antlers=True),
}

HEAD = Vector((0.0, 1.84, 0.0))
# Tay đặt ra ngoài thân để Remesh không dính cánh tay vào hông (giữ đồng bộ MODEL_ARM_X trong buildCharacter.ts)
ARM_X = 0.45
FPS = 24

# ---------------------------------------------------------------- Tiện ích


def T(x, y, z):
    """Three.js (x, y lên, z trước) -> Blender (x, -z, y)."""
    return Vector((x, -z, y))


def V3(p):
    return Vector((p[0], p[1], p[2]))


def three_of(bl):
    """Blender -> Three.js."""
    return Vector((bl.x, bl.z, -bl.y))


def lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(hexv):
    r = ((hexv >> 16) & 255) / 255.0
    g = ((hexv >> 8) & 255) / 255.0
    b = (hexv & 255) / 255.0
    return (lin(r), lin(g), lin(b), 1.0)


def darken(hexv, f):
    r = int(((hexv >> 16) & 255) * f)
    g = int(((hexv >> 8) & 255) * f)
    b = int((hexv & 255) * f)
    return (r << 16) | (g << 8) | b


_mats = {}


def material(name, hexv):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = rgba(hexv)
        bsdf.inputs['Roughness'].default_value = 0.9
    m.diffuse_color = rgba(hexv)
    _mats[name] = m
    return m


def scale_m(sx, sy, sz):
    return Matrix.Diagonal((sx, sy, sz, 1.0))


def rot_three(rx=0.0, ry=0.0, rz=0.0):
    """Xoay theo trục Three.js (x, y lên, z trước) -> ma trận Blender."""
    return Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(ry, 4, 'Z') @ Matrix.Rotation(-rz, 4, 'Y')


def ell(bm, center, radii, seg=24, rings=16, rot=None):
    """Ellipsoid, center và radii theo hệ Three.js."""
    r = radii if isinstance(radii, (tuple, list)) else (radii, radii, radii)
    m = Matrix.Translation(T(*center))
    if rot is not None:
        m = m @ rot
    m = m @ scale_m(r[0], r[2], r[1])
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0, matrix=m)


def cyl(bm, p1, p2, r1, r2=None, seg=18):
    """Trụ nối hai điểm (Three.js), r1 ở p1, r2 ở p2."""
    r2 = r1 if r2 is None else r2
    a = T(*p1)
    b = T(*p2)
    d = b - a
    rot = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4()
    m = Matrix.Translation((a + b) / 2) @ rot
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r1, radius2=r2, depth=d.length, matrix=m)


def cone_at(bm, base, height, radius, rot=None, seg=12):
    """Nón đáy tại base (Three.js), hướng +y, xoay bằng rot (ma trận Blender)."""
    m = Matrix.Translation(T(*base))
    if rot is not None:
        m = m @ rot
    m = m @ Matrix.Translation((0, 0, height / 2))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=radius, radius2=0.0, depth=height, matrix=m)


def bm_to_object(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for mt in mats:
        me.materials.append(mt)
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def apply_modifiers(ob):
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    mats = list(ob.data.materials)
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    if len(me.materials) == 0:
        for mt in mats:
            me.materials.append(mt)
    for p in me.polygons:
        p.use_smooth = True


def blobify(ob, voxel=0.025, smooth=(0.5, 5), ratio=0.3):
    """Remesh voxel -> Smooth -> Decimate: biến cụm khối thành một bề mặt liền, mượt, ít tam giác."""
    rm = ob.modifiers.new('Remesh', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = voxel
    rm.use_smooth_shade = True
    sm = ob.modifiers.new('Smooth', 'SMOOTH')
    sm.factor = smooth[0]
    sm.iterations = smooth[1]
    dc = ob.modifiers.new('Decimate', 'DECIMATE')
    dc.ratio = ratio
    dc.use_collapse_triangulate = True
    apply_modifiers(ob)


def inside(p, c, r):
    return ((p.x - c[0]) / r[0]) ** 2 + ((p.y - c[1]) / r[1]) ** 2 + ((p.z - c[2]) / r[2]) ** 2 <= 1.0


def assign_regions(ob, regions):
    """regions: [(material, predicate(three_point))], vùng đầu khớp thắng; cuối cùng là mặc định."""
    me = ob.data
    me.materials.clear()
    for mt, _ in regions:
        me.materials.append(mt)
    for p in me.polygons:
        tp = three_of(p.center)
        p.material_index = len(regions) - 1
        for i, (_, pred) in enumerate(regions):
            if pred(tp):
                p.material_index = i
                break


def dist_point_segment(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(1e-9, ab.length_squared)))
    return (a + ab * t - p).length


# ---------------------------------------------------------------- Xương


def ear_base(spec, sx):
    base = {
        'round': (0.25, 0.3, 0.0),
        'pointed': (0.21, 0.33, -0.02),
        'long': (0.14, 0.38, -0.02),
        'small': (0.27, 0.25, 0.0),
        'wide': (0.36, 0.17, 0.0),
    }[spec['ear']]
    return (sx * base[0], HEAD.y + base[1], base[2])


def build_armature(spec):
    arm_data = bpy.data.armatures.new('Armature')
    arm = bpy.data.objects.new('Armature', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head = T(*head)
        b.tail = T(*tail)
        b.roll = 0.0
        if parent:
            b.parent = eb[parent]
        return b

    bone('Hips', (0, 0.62, 0), (0, 0.8, 0))
    bone('Spine', (0, 0.8, 0), (0, 1.1, 0), 'Hips')
    bone('Chest', (0, 1.1, 0), (0, 1.42, 0), 'Spine')
    bone('Neck', (0, 1.42, 0), (0, 1.56, 0), 'Chest')
    bone('Head', (0, 1.56, 0), (0, 2.1, 0), 'Neck')
    for s, sx in (('L', 1), ('R', -1)):
        eb_base = ear_base(spec, sx)
        bone('Ear.' + s, eb_base, (eb_base[0] + sx * 0.08, eb_base[1] + 0.25, eb_base[2]), 'Head')
        ax = sx * ARM_X
        bone('UpperArm.' + s, (ax, 1.3, 0), (ax, 0.97, 0), 'Chest')
        bone('Forearm.' + s, (ax, 0.97, 0), (ax, 0.66, 0.125), 'UpperArm.' + s)
        bone('Hand.' + s, (ax, 0.66, 0.125), (ax, 0.5, 0.15), 'Forearm.' + s)
        bone('Thigh.' + s, (sx * 0.15, 0.62, 0), (sx * 0.15, 0.36, 0), 'Hips')
        bone('Shin.' + s, (sx * 0.15, 0.36, 0), (sx * 0.15, 0.1, 0.01), 'Thigh.' + s)
        bone('Foot.' + s, (sx * 0.15, 0.1, 0.01), (sx * 0.15, 0.05, 0.22), 'Shin.' + s)
    bone('Tail', (0, 0.66, -0.29), (0, 0.5, -0.6), 'Hips')
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.select_set(False)
    return arm


def skin_manual(body, arm):
    body.parent = arm
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    bones = [(b.name, b.head_local.copy(), b.tail_local.copy()) for b in arm.data.bones]
    groups = {n: body.vertex_groups.new(name=n) for n, _, _ in bones}
    for v in body.data.vertices:
        ds = sorted((dist_point_segment(v.co, h, t), n) for n, h, t in bones)
        (d0, n0), (d1, n1) = ds[0], ds[1]
        gap = d1 - d0
        if gap > 0.08:
            groups[n0].add([v.index], 1.0, 'REPLACE')
        else:
            w1 = 0.5 * (1.0 - gap / 0.08)
            groups[n0].add([v.index], 1.0 - w1, 'REPLACE')
            groups[n1].add([v.index], w1, 'REPLACE')


def skin_auto(body, arm):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    body.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    ok = False
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        ok = any(len(v.groups) > 0 for v in body.data.vertices)
    except Exception as e:  # noqa: BLE001
        print('ARMATURE_AUTO thất bại, dùng trọng số thủ công:', e)
    if not ok:
        skin_manual(body, arm)
    body.select_set(False)
    arm.select_set(False)
    return ok


def skin_to_bone(ob, arm, bone_name):
    ob.parent = arm
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    vg = ob.vertex_groups.new(name=bone_name)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')


# ---------------------------------------------------------------- Thân liền


def snout_region(spec):
    """(center, radii) ellipsoid mõm theo hệ Three.js, dùng cả để dựng và để tô màu."""
    kind = spec['snout']
    if kind == 'long':
        return (0.0, HEAD.y - 0.1, 0.34), (0.14, 0.109, 0.196)
    if kind == 'medium':
        return (0.0, HEAD.y - 0.1, 0.3), (0.165, 0.123, 0.158)
    if kind == 'short':
        return (0.0, HEAD.y - 0.1, 0.28), (0.184, 0.128, 0.128)
    return (0.0, HEAD.y - 0.09, 0.33), (0.154, 0.1, 0.12)


def build_body(spec, fur, furdark, belly, snoutM, maskM):
    bm = bmesh.new()
    # Đầu + mõm
    ell(bm, HEAD, (0.36, 0.338, 0.346), seg=32, rings=20)
    sc, sr = snout_region(spec)
    if spec['snout'] == 'flat':
        ell(bm, sc, sr)
        cyl(bm, (0, HEAD.y - 0.08, 0.3), (0, HEAD.y - 0.08, 0.43), 0.1, 0.11)
    else:
        ell(bm, sc, sr)
    # Cổ, thân, hông
    cyl(bm, (0, 1.38, 0), (0, 1.58, 0), 0.125, 0.11)
    ell(bm, (0, 1.0, 0), (0.31, 0.4125, 0.29), seg=32, rings=20)
    ell(bm, (0, 0.66, 0), (0.29, 0.16, 0.25))
    for sx in (-1, 1):
        # Tay (cách thân một khe để Remesh không dính)
        ax = sx * ARM_X
        ell(bm, (ax, 1.3, 0), 0.09)
        cyl(bm, (ax, 1.3, 0), (ax, 0.97, 0), 0.08, 0.077)
        ell(bm, (ax, 0.97, 0), 0.075)
        cyl(bm, (ax, 0.97, 0), (ax, 0.66, 0.125), 0.07, 0.066)
        ell(bm, (ax, 0.66, 0.125), 0.066)
        # Chân
        cyl(bm, (sx * 0.15, 0.62, 0), (sx * 0.15, 0.36, 0), 0.105, 0.095)
        ell(bm, (sx * 0.15, 0.36, 0), 0.09)
        cyl(bm, (sx * 0.15, 0.36, 0), (sx * 0.15, 0.1, 0.01), 0.085, 0.08)
        ell(bm, (sx * 0.15, 0.1, 0.01), 0.075)
    body = bm_to_object('Body', bm, [fur])
    blobify(body, voxel=0.021, smooth=(0.5, 5), ratio=0.16)

    regions = []
    sc2 = sc
    sr2 = tuple(r * 1.12 for r in sr)
    regions.append((snoutM, lambda p: inside(p, sc2, sr2) and p.z > HEAD.z + 0.22))
    if maskM is not None:
        regions.append((maskM, lambda p: inside(p, (0, HEAD.y - 0.12, 0.2), (0.27, 0.2, 0.3))))
    spots = [(-0.12, 1.18, -0.26), (0.1, 1.08, -0.27), (-0.05, 0.92, -0.28), (0.17, 1.22, -0.24),
             (-0.19, 0.98, -0.25), (0.08, 0.8, -0.26), (-0.24, 1.2, 0.0), (0.26, 1.05, -0.05)]

    def belly_pred(p):
        if inside(p, (0, 0.98, 0.2), (0.21, 0.28, 0.34)):
            return True
        if spec.get('spots'):
            for s in spots:
                if (p - V3(s)).length < 0.065:
                    return True
        return False

    regions.append((belly, belly_pred))
    regions.append((fur, lambda p: True))
    assign_regions(body, regions)
    return body


# ---------------------------------------------------------------- Bộ phận rời


def build_ears(spec, arm, fur, furdark, maskM):
    inner = material('EarInner', spec['earInner']) if 'earInner' in spec else (maskM if maskM else furdark)
    tip = material('EarTip', spec['earTip']) if 'earTip' in spec else None
    kind = spec['ear']
    for s, sx in (('L', 1), ('R', -1)):
        base = V3(ear_base(spec, sx))
        bm = bmesh.new()
        regions = []
        if kind == 'round':
            ell(bm, base, 0.12, seg=20, rings=14)
            ic = (base.x, base.y, base.z + 0.06)
            regions.append((inner, lambda p, ic=ic: (p - V3(ic)).length < 0.085))
        elif kind == 'pointed':
            rot = rot_three(rz=-sx * 0.15)
            cone_at(bm, base, 0.3, 0.11, rot=rot, seg=14)
            if tip is not None:
                regions.append((tip, lambda p, b=base: p.y > b.y + 0.2))
            regions.append((inner, lambda p, b=base: p.z > b.z + 0.03 and p.y < b.y + 0.2 and p.y > b.y + 0.02))
        elif kind == 'long':
            rot = rot_three(rx=-0.1, rz=-sx * 0.12)
            tipp = base + Vector((sx * 0.05, 0.45, -0.045))
            cyl(bm, base, tipp, 0.065, 0.06, seg=16)
            ell(bm, base, 0.065)
            ell(bm, tipp, 0.06)
            regions.append((inner, lambda p, b=base: p.z > b.z + 0.025 and abs(p.x - b.x) < 0.04 and b.y + 0.06 < p.y < b.y + 0.42))
            del rot
        elif kind == 'small':
            rot = rot_three(rz=-sx * 0.5)
            cone_at(bm, base, 0.17, 0.08, rot=rot, seg=12)
            regions.append((inner, lambda p, b=base: p.z > b.z + 0.02 and p.y > b.y + 0.01))
        else:  # wide
            rot = rot_three(rz=-sx * 0.6)
            ell(bm, base, (0.182, 0.091, 0.052), seg=20, rings=14, rot=rot)
            regions.append((inner, lambda p, b=base: p.z > b.z + 0.012))
        regions.append((fur, lambda p: True))
        # Tên lưới khác tên xương (Ear.L) để game không nhầm khi tìm theo tên
        ob = bm_to_object('EarMesh.' + s, bm, [fur])
        if kind == 'long':
            blobify(ob, voxel=0.014, smooth=(0.4, 3), ratio=0.35)
        assign_regions(ob, regions)
        skin_to_bone(ob, arm, 'Ear.' + s)


def build_tail(spec, arm, fur, belly):
    base = Vector((0.0, 0.66, -0.29))
    kind = spec['tail']
    tipM = material('TailTip', spec['tailTip']) if 'tailTip' in spec else belly
    bm = bmesh.new()
    regions = []
    if kind == 'stub':
        ell(bm, base, 0.075)
    elif kind == 'bushy':
        d = Vector((0, -0.59, -0.81))
        a = base + d * 0.02
        b = base + d * 0.36
        cyl(bm, a, b, 0.1, 0.09, seg=16)
        ell(bm, a, 0.1)
        tipc = base + d * 0.4
        ell(bm, tipc, 0.095)
        regions.append((tipM, lambda p, c=tipc: (p - c).length < 0.105))
    elif kind == 'puff':
        ell(bm, base, 0.11)
        regions.append((belly, lambda p: True))
    elif kind == 'short':
        end = base + Vector((0, -0.2, -0.1))
        cyl(bm, base, end, 0.022, 0.016, seg=10)
        ell(bm, end, 0.03)
    elif kind == 'long':
        end = base + Vector((0, -0.42, -0.2))
        cyl(bm, base, end, 0.055, 0.05, seg=14)
        ell(bm, base, 0.055)
        ell(bm, end, 0.06)
        regions.append((belly, lambda p, e=end: (p - e).length < 0.07))
    else:  # flag
        ell(bm, base, (0.075, 0.09, 0.0375))
        regions.append((tipM, lambda p: True))
    regions.append((fur, lambda p: True))
    ob = bm_to_object('TailMesh', bm, [fur])
    if kind in ('bushy', 'long'):
        blobify(ob, voxel=0.016, smooth=(0.4, 3), ratio=0.35)
    assign_regions(ob, regions)
    skin_to_bone(ob, arm, 'Tail')


def build_paws_feet(arm, furdark):
    for s, sx in (('L', 1), ('R', -1)):
        hx = sx * ARM_X
        bm = bmesh.new()
        ell(bm, (hx, 0.636, 0.13), (0.0735, 0.056, 0.0875))
        for i in (-1, 0, 1):
            ell(bm, (hx + i * 0.046, 0.575, 0.16), 0.034, seg=12, rings=8)
        ell(bm, (hx + sx * 0.072, 0.622, 0.15), 0.03, seg=12, rings=8)
        paw = bm_to_object('Paw.' + s, bm, [furdark])
        blobify(paw, voxel=0.011, smooth=(0.4, 3), ratio=0.3)
        skin_to_bone(paw, arm, 'Hand.' + s)

        fx = sx * 0.15
        bm = bmesh.new()
        ell(bm, (fx, 0.06, 0.05), (0.12, 0.06, 0.168))
        for i in (-1, 0, 1):
            ell(bm, (fx + i * 0.07, 0.05, 0.2), (0.04, 0.032, 0.04), seg=12, rings=8)
        foot = bm_to_object('FootMesh.' + s, bm, [furdark])
        blobify(foot, voxel=0.012, smooth=(0.4, 3), ratio=0.3)
        skin_to_bone(foot, arm, 'Foot.' + s)


def build_head_parts(spec, arm, fur, maskM, belly):
    noseM = material('Nose', spec['nose'])
    kind = spec['snout']
    bm = bmesh.new()
    if kind == 'flat':
        cyl(bm, (0, HEAD.y - 0.08, 0.425), (0, HEAD.y - 0.08, 0.45), 0.1, 0.1, seg=20)
        nose = bm_to_object('Nose', bm, [noseM])
        bm = bmesh.new()
        ell(bm, (-0.035, HEAD.y - 0.08, 0.455), 0.018, seg=10, rings=8)
        ell(bm, (0.035, HEAD.y - 0.08, 0.455), 0.018, seg=10, rings=8)
        nostrils = bm_to_object('Nostrils', bm, [material('Nostril', 0x2A1A14)])
        skin_to_bone(nostrils, arm, 'Head')
    else:
        z = {'long': 0.53, 'medium': 0.45, 'short': 0.4}[kind]
        y = {'long': -0.05, 'medium': -0.045, 'short': -0.04}[kind]
        ell(bm, (0, HEAD.y + y, z), (0.066, 0.047, 0.044), seg=14, rings=10)
        nose = bm_to_object('Nose', bm, [noseM])
    skin_to_bone(nose, arm, 'Head')

    # Chỏm lông đỉnh đầu
    bm = bmesh.new()
    for tx, tz, rz in ((0.0, 0.03, 0.1), (-0.07, 0.06, 0.45), (0.06, -0.01, -0.4)):
        cone_at(bm, (tx, HEAD.y + 0.3, tz), 0.14, 0.045, rot=rot_three(rz=rz), seg=8)
    tuft = bm_to_object('HeadTuft', bm, [fur])
    skin_to_bone(tuft, arm, 'Head')

    if spec.get('cheeks') == 'tufts':
        tuftM = maskM if maskM else belly
        bm = bmesh.new()
        for sx in (-1, 1):
            cone_at(bm, (sx * 0.26, HEAD.y - 0.07, 0.1), 0.2, 0.075,
                    rot=Matrix.Rotation(sx * math.pi / 2, 4, 'Y') @ Matrix.Rotation(sx * 0.2, 4, 'Z'), seg=10)
        cheeks = bm_to_object('CheekTufts', bm, [tuftM])
        skin_to_bone(cheeks, arm, 'Head')

    if spec.get('tusks'):
        bm = bmesh.new()
        for sx in (-1, 1):
            cone_at(bm, (sx * 0.11, HEAD.y - 0.2, 0.38), 0.15, 0.028,
                    rot=rot_three(rx=0.5, rz=-sx * 0.35), seg=8)
        tusks = bm_to_object('Tusks', bm, [material('Ivory', 0xF2EAD8)])
        skin_to_bone(tusks, arm, 'Head')

    if spec.get('antlers'):
        antM = material('Antler', 0xA98B6A)
        bm = bmesh.new()
        for sx in (-1, 1):
            cyl(bm, (sx * 0.14, HEAD.y + 0.28, -0.04), (sx * 0.36, HEAD.y + 0.68, -0.04), 0.028, 0.02, seg=8)
            ell(bm, (sx * 0.36, HEAD.y + 0.68, -0.04), 0.02, seg=8, rings=6)
            cyl(bm, (sx * 0.3, HEAD.y + 0.58, -0.04), (sx * 0.5, HEAD.y + 0.68, -0.04), 0.02, 0.014, seg=8)
            cyl(bm, (sx * 0.26, HEAD.y + 0.52, -0.02), (sx * 0.2, HEAD.y + 0.76, 0.04), 0.017, 0.012, seg=8)
        antlers = bm_to_object('Antlers', bm, [antM])
        skin_to_bone(antlers, arm, 'Head')


# ---------------------------------------------------------------- Animation


def make_action(arm, name, length, keys):
    """keys: [(bone, frame, rot_xyz | None, loc_xyz | None)]."""
    ad = arm.animation_data
    act = bpy.data.actions.new(name)
    ad.action = act
    for bone, frame, rot, loc in keys:
        pb = arm.pose.bones[bone]
        if rot is not None:
            pb.rotation_euler = rot
            pb.keyframe_insert('rotation_euler', frame=frame)
        if loc is not None:
            pb.location = loc
            pb.keyframe_insert('location', frame=frame)
    act.use_frame_range = True
    act.frame_start = 0
    act.frame_end = length
    for pb in arm.pose.bones:
        pb.rotation_euler = (0.0, 0.0, 0.0)
        pb.location = (0.0, 0.0, 0.0)
    ad.action = None
    track = ad.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    return act


def animate(arm):
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    arm.animation_data_create()

    # Idle 3 giây: thở, đầu lắc nhẹ, tay đung đưa
    idle = []
    for f, v in ((0, 0.0), (36, 0.035), (72, 0.0)):
        idle.append(('Chest', f, (v, 0, 0), None))
        idle.append(('Hips', f, None, (0, v * 0.3, 0)))
    for f, v in ((0, 0.0), (24, 0.05), (48, -0.05), (72, 0.0)):
        idle.append(('Head', f, (0, 0, v), None))
    for f, v in ((0, 0.0), (36, 0.05), (72, 0.0)):
        idle.append(('UpperArm.L', f, (v, 0, 0), None))
        idle.append(('UpperArm.R', f, (-v, 0, 0), None))
    make_action(arm, 'Idle', 72, idle)

    # Walk 17 khung (~0.7 s): chân tay vung so le, gối gập khi đưa chân về trước
    walk = []
    for f, s in ((0, 1.0), (8, -1.0), (16, 1.0)):
        walk.append(('Thigh.L', f, (0.55 * s, 0, 0), None))
        walk.append(('Thigh.R', f, (-0.55 * s, 0, 0), None))
        walk.append(('UpperArm.L', f, (-0.5 * s, 0, 0), None))
        walk.append(('UpperArm.R', f, (0.5 * s, 0, 0), None))
        walk.append(('Spine', f, (0, 0.05 * s, 0), None))
    for f, l, r in ((0, 0.1, 0.7), (4, 0.6, 0.2), (8, 0.7, 0.1), (12, 0.2, 0.6), (16, 0.1, 0.7)):
        walk.append(('Shin.L', f, (-l, 0, 0), None))
        walk.append(('Shin.R', f, (-r, 0, 0), None))
    make_action(arm, 'Walk', 16, walk)

    # Talk 0.5 s: gật đầu
    talk = []
    for f, v in ((0, 0.0), (3, 0.1), (6, 0.0), (9, -0.06), (12, 0.0)):
        talk.append(('Head', f, (v, 0, 0), None))
        talk.append(('Neck', f, (v * 0.5, 0, 0), None))
    make_action(arm, 'Talk', 12, talk)


# ---------------------------------------------------------------- Xuất


def export_glb(path):
    kwargs = dict(
        filepath=path, export_format='GLB', export_yup=True, export_apply=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_skins=True,
        export_morph=False, export_texcoords=False, export_normals=True,
        export_materials='EXPORT', export_cameras=False, export_lights=False,
        export_rest_position_armature=True, export_def_bones=False,
        export_optimize_animation_size=False,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError as e:
        print('Tham số export không hợp lệ, thử lại với bộ tối thiểu:', e)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True,
                                  export_animations=True, export_skins=True, export_texcoords=False)


def build_species(sid, spec, out_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _mats.clear()
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.frame_start = 0
    scene.frame_end = 72

    fur = material('Fur', spec['fur'])
    furdark = material('FurDark', darken(spec['fur'], 0.7))
    belly = material('Belly', spec['belly'])
    snoutM = material('Snout', spec['snoutColor'])
    maskM = material('Mask', spec['mask']) if 'mask' in spec else None

    arm = build_armature(spec)
    body = build_body(spec, fur, furdark, belly, snoutM, maskM)
    auto = skin_auto(body, arm)
    build_ears(spec, arm, fur, furdark, maskM)
    build_tail(spec, arm, fur, belly)
    build_paws_feet(arm, furdark)
    build_head_parts(spec, arm, fur, maskM, belly)
    animate(arm)

    tris = sum(len(p.vertices) - 2 for o in scene.objects if o.type == 'MESH' for p in o.data.polygons)
    path = os.path.join(out_dir, sid + '.glb')
    export_glb(path)
    size = os.path.getsize(path) if os.path.exists(path) else 0
    print(f'[{sid}] {tris} tam giác, trọng số {"tự động" if auto else "thủ công"}, {size // 1024} KB -> {path}')


def main():
    argv = sys.argv
    out_dir = argv[argv.index('--') + 1] if '--' in argv and argv.index('--') + 1 < len(argv) else 'public/models'
    out_dir = os.path.abspath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    only = argv[argv.index('--') + 2:] if '--' in argv else []
    for sid, spec in SPECIES.items():
        if only and sid not in only:
            continue
        build_species(sid, spec, out_dir)
    print('Xong.')


main()
