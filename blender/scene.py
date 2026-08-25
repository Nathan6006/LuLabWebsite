"""
The lipid nanoparticle, built procedurally in Blender.

The reference is the cutaway render on the Nucleic Acid Therapies card: a
sphere with a section removed so you can see the individual lipid molecules
making up the shell, and the cargo packed inside it. That means modelling the
lipids as molecules — a head group and two tails each — and instancing a few
thousand of them, rather than approximating a membrane with a glass sphere.

Three shots, in the order the page plays them:

  section  the cut plane retracts from a cross-section to a closed sphere
  travel   the closed sphere, small and glowing, for the journey through the body
  release  the shell parts and a single-stranded mRNA helix emerges

  blender -b -P blender/scene.py -- --shot section --frames 24 --res 800

Everything is generated from the constants below, so the particle is still
defined by numbers in a file that can be diffed, not by hand-modelling.
"""
import bpy, bmesh, sys, math, os, argparse, random
from mathutils import Vector, Quaternion

# ---- Structure ------------------------------------------------------------
R_OUT = 1.00               # outer leaflet: head centres sit here
R_IN = 0.86                # inner leaflet
LIPID_COUNT_OUT = 1500
LIPID_COUNT_IN = 900

# Inverted micelles. This is the part the earlier version had wrong: the cargo
# does not float loose in the core. Ionizable lipids condense the nucleic acid
# into micelles with their head groups turned inward around it, and those
# micelles pack the interior. See the reference render on the research card.
MICELLE_COUNT = 4
MICELLE_R = 0.24
MICELLE_LIPIDS = 210
MICELLE_CARGO_R = 0.125
INTERSTITIAL = 190
HEAD_R = 0.030
TAIL_R = 0.0075
TAIL_LEN = 0.20
TAIL_SPREAD = 0.022        # how far apart the two tails start
CARGO_STRANDS = 6
CARGO_TURNS = 4
CARGO_R = 0.019

# The strand released at the end. Single-stranded mRNA is drawn the way it is
# usually drawn: one long backbone with nucleotides branching off it. No helix
# — that is DNA's double helix, and this is not that molecule.
STRAND_LEN = 1.85
STRAND_WAVE = 0.20          # gentle undulation, so it is not a ruled line
BACKBONE_R = 0.026
NUC_STALK = 0.085           # how far a nucleotide stands off the backbone
NUC_R = 0.027
NUC_EVERY = 3               # place one every N path samples

SEED = 20260825

# ---- Palette (linear; the site's tokens are sRGB) -------------------------
def srgb(hexstr, alpha=1.0):
    n = int(hexstr.lstrip('#'), 16)
    out = []
    for shift in (16, 8, 0):
        c = ((n >> shift) & 255) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], alpha)

C_HEAD_OUT = srgb('#7fb0d4')   # PEG-ish outer heads, cool and pale
C_HEAD_IN = srgb('#2f7fbe')    # inner leaflet, deeper blue
C_TAIL = srgb('#9fc4dd')
C_IONIZABLE = srgb('#c4381c')  # the ECO-like ionizable lipid, copper
C_CARGO = srgb('#f2a03d')      # nucleic acid, amber
C_BASE = srgb('#fff2d8')
GROUND = srgb('#09143a')


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                 bpy.data.lights, bpy.data.objects):
        for b in list(coll):
            if getattr(b, 'users', 0) == 0:
                try:
                    coll.remove(b)
                except Exception:
                    pass


def principled(name, **kw):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    for k, v in kw.items():
        if k in b.inputs:
            b.inputs[k].default_value = v
        else:
            print(f'MISSING SOCKET: {k} on {name}')
    return m


def blob_material(name):
    """
    The condensed cargo's surface.

    Two layers of bump, in object coordinates so the texture sticks to the blob
    instead of swimming when it moves: a Voronoi for the globular pocking that
    reads as a space-filling molecular surface, and a noise underneath it for
    larger undulation. Bump rather than displacement — at this size the
    silhouette detail would not survive the downscale, and displacement would
    need the metaball mesh subdivided.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = srgb('#d9d3c8')
    bsdf.inputs['Roughness'].default_value = 0.52
    if 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = 0.16
        bsdf.inputs['Subsurface Radius'].default_value = (0.4, 0.3, 0.25)

    coord = nt.nodes.new('ShaderNodeTexCoord')

    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 20.0
    nt.links.new(coord.outputs['Object'], vor.inputs['Vector'])

    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 13.0
    noise.inputs['Detail'].default_value = 6.0
    nt.links.new(coord.outputs['Object'], noise.inputs['Vector'])

    coarse = nt.nodes.new('ShaderNodeBump')
    coarse.inputs['Strength'].default_value = 0.9
    coarse.inputs['Distance'].default_value = 0.16
    nt.links.new(noise.outputs['Fac'], coarse.inputs['Height'])

    fine = nt.nodes.new('ShaderNodeBump')
    fine.inputs['Strength'].default_value = 1.0
    fine.inputs['Distance'].default_value = 0.07
    out = 'Distance' if 'Distance' in vor.outputs else 'Fac'
    nt.links.new(vor.outputs[out], fine.inputs['Height'])
    # Layered: the coarse undulation feeds the fine pocking's normal.
    nt.links.new(coarse.outputs['Normal'], fine.inputs['Normal'])
    nt.links.new(fine.outputs['Normal'], bsdf.inputs['Normal'])
    return m


def mesh_from_bm(bm, name, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return me


def lipid_mesh(name):
    """
    One lipid: a head group and two tails, built along -Z from the head.

    Local +Z is 'outward', so placing one is a matter of pointing its Z along
    the radius. The tails curl rather than running straight, which is most of
    what makes a packed shell read as molecules instead of bristles.
    """
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=8, radius=HEAD_R)

    steps = 7
    for side in (-1, 1):
        prev = None
        for i in range(steps + 1):
            t = i / steps
            x = side * TAIL_SPREAD * (0.35 + 0.65 * t)
            # A gentle S so the tails are not parallel sticks.
            y = math.sin(t * math.pi * 1.6) * 0.018 * side
            z = -HEAD_R * 0.6 - t * TAIL_LEN
            r = TAIL_R * (1.0 - 0.35 * t)
            seg = bmesh.ops.create_uvsphere(bm, u_segments=7, v_segments=5, radius=r)
            for v in seg['verts']:
                v.co += Vector((x, y, z))
            prev = (x, y, z)
    return mesh_from_bm(bm, name)


def fib_dirs(n, seed):
    """Evenly spaced directions, jittered so the packing is not a visible grid."""
    rnd = random.Random(seed)
    ga = math.pi * (3.0 - math.sqrt(5.0))
    out = []
    for i in range(n):
        y = 1 - (i / max(1, n - 1)) * 2
        r = math.sqrt(max(0.0, 1 - y * y))
        a = ga * i
        d = Vector((math.cos(a) * r, y, math.sin(a) * r))
        j = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.035
        out.append((d + j).normalized())
    return out


def build_leaflet(me, mats, count, radius, outward, seed, tag,
                  centre=None, mat_key=None, scale=1.0):
    """
    A shell of lipids sharing one mesh datablock.

    Sharing the datablock is what makes a few thousand molecules cheap: Cycles
    instances them, so the memory cost is one lipid plus a transform each.
    """
    rnd = random.Random(seed)
    centre = Vector((0.0, 0.0, 0.0)) if centre is None else centre
    objs = []
    for d in fib_dirs(count, seed):
        o = bpy.data.objects.new(tag, me)
        # A small minority are the ionizable lipid, which is the one the lab's
        # chemistry is actually about; the rest are structural.
        o.data = me
        o.color = (1, 1, 1, 1)
        if mat_key:
            mat = mats[mat_key]
        else:
            mat = mats['ionizable'] if rnd.random() < 0.18 else mats['lipid_out' if outward else 'lipid_in']
        o.material_slots  # noqa: touch
        bpy.context.scene.collection.objects.link(o)
        if len(o.material_slots) == 0:
            o.data.materials.append(mats['lipid_out'])
        o.material_slots[0].link = 'OBJECT'
        o.material_slots[0].material = mat
        axis = d if outward else -d
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = axis.to_track_quat('Z', 'Y')
        o.location = centre + d * radius
        o.scale = (scale, scale, scale * rnd.uniform(0.88, 1.12))
        # The cut is a plane, so the test has to be on world position. Testing
        # the direction only works for a shell centred on the origin, and the
        # micelles are not.
        objs.append((o, o.location.copy()))
    return objs


def parallel_frames(pts):
    """
    Tangent/normal/binormal along a path, carried forward without twisting.

    Computing the normal fresh at each step (say, from a fixed up-vector) makes
    it flip wherever the path turns through vertical, which puts a visible
    kink in anything swept along it. Carrying the previous normal forward and
    re-orthogonalising is what keeps the winding continuous.
    """
    frames = []
    n_prev = None
    for i, p in enumerate(pts):
        nxt = pts[min(len(pts) - 1, i + 1)]
        prv = pts[max(0, i - 1)]
        t = (Vector(nxt) - Vector(prv))
        if t.length < 1e-9:
            t = Vector((1, 0, 0))
        t.normalize()
        if n_prev is None:
            seed_v = Vector((0, 0, 1))
            if abs(seed_v.dot(t)) > 0.9:
                seed_v = Vector((1, 0, 0))
            nrm = (seed_v - t * seed_v.dot(t)).normalized()
        else:
            nrm = (n_prev - t * n_prev.dot(t))
            nrm = nrm.normalized() if nrm.length > 1e-9 else Vector((0, 0, 1))
        b = t.cross(nrm)
        frames.append((Vector(p), t, nrm, b))
        n_prev = nrm
    return frames


def nucleotide_mesh(name, mats_list):
    """
    One nucleotide: a stalk and a base, as a single stretched primitive whose
    origin sits ON the backbone, so placing one is just a position and a
    direction.
    """
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=7, radius=NUC_R)
    bmesh.ops.scale(bm, vec=Vector((1.9, 0.62, 0.42)), verts=bm.verts)
    bmesh.ops.translate(bm, vec=Vector((NUC_STALK + NUC_R * 0.9, 0, 0)), verts=bm.verts)
    # A thin stalk back to the backbone.
    stalk = bmesh.ops.create_cone(
        bm, cap_ends=True, segments=8,
        radius1=NUC_R * 0.28, radius2=NUC_R * 0.28, depth=NUC_STALK + NUC_R)
    bmesh.ops.rotate(bm, verts=stalk['verts'],
                     cent=Vector((0, 0, 0)),
                     matrix=Quaternion((0, 1, 0), math.pi / 2).to_matrix())
    bmesh.ops.translate(bm, vec=Vector(((NUC_STALK + NUC_R) / 2, 0, 0)),
                        verts=stalk['verts'])
    me = mesh_from_bm(bm, name)
    for m in mats_list:
        me.materials.append(m)
    return me


def nucleic_strand(name, guide, mats, backbone_r=BACKBONE_R, every=NUC_EVERY):
    """
    A nucleic acid strand: a backbone following `guide`, with nucleotides
    branching off it.

    Both the condensed cargo and the strand released at the end are built with
    this, so the molecule that comes out is visibly the one that was packed in.
    The nucleotides fan around the backbone rather than all pointing one way,
    which is what stops it reading as a comb.
    """
    frames = parallel_frames(guide)
    total = 0.0
    arc = [0.0]
    for i in range(1, len(frames)):
        total += (frames[i][0] - frames[i - 1][0]).length
        arc.append(total)

    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 8
    cu.bevel_depth = backbone_r
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(frames) - 1)
    for i, (p, t, nrm, bn) in enumerate(frames):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    sp.use_endpoint_u = True
    sp.order_u = 4
    backbone = bpy.data.objects.new(name, cu)
    backbone.data.materials.append(mats['cargo'])
    bpy.context.scene.collection.objects.link(backbone)

    nuc_mats = [mats['nuc_a'], mats['nuc_u'], mats['nuc_g'], mats['nuc_c']]
    me = nucleotide_mesh(name + '_nuc', nuc_mats)

    rnd = random.Random(SEED + 31)
    nucs = []
    for i in range(0, len(frames), every):
        p, t, nrm, bn = frames[i]
        # Fan the nucleotides around the backbone as it advances.
        a = i * 0.85
        outward = (nrm * math.cos(a) + bn * math.sin(a)).normalized()
        o = bpy.data.objects.new(name + '_nuc', me)
        bpy.context.scene.collection.objects.link(o)
        o.location = p
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = outward.to_track_quat('X', 'Z')
        # Four bases, so the strand reads as a sequence rather than a repeat.
        o.material_slots  # noqa
        for sl in range(len(o.material_slots)):
            o.material_slots[sl].link = 'OBJECT'
        if len(o.material_slots) > 0:
            o.material_slots[0].material = nuc_mats[rnd.randrange(4)]
        o.parent = backbone
        nucs.append((o, arc[i] / max(1e-6, total)))
    return backbone, nucs


def micelle_sites(n, seed):
    """Micelle centres, spread inside the core without overlapping."""
    rnd = random.Random(seed)
    sites = []
    guard = 0
    while len(sites) < n and guard < 4000:
        guard += 1
        p = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
        if p.length > 1.0:
            continue
        p = p * (R_IN - MICELLE_R - 0.16)
        if all((p - q).length > MICELLE_R * 2.5 for q in sites):
            sites.append(p)
    return sites


def build_interstitial(me, mats):
    """Loose lipids packing the space between micelles."""
    rnd = random.Random(SEED + 71)
    out = []
    for i in range(INTERSTITIAL):
        p = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1)))
        if p.length > 1.0 or p.length < 0.15:
            continue
        p = p * (R_IN - 0.10)
        o = bpy.data.objects.new('inter', me)
        bpy.context.scene.collection.objects.link(o)
        if len(o.material_slots) > 0:
            o.material_slots[0].link = 'OBJECT'
            o.material_slots[0].material = mats['ionizable'] if rnd.random() < 0.6 else mats['lipid_in']
        d = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = d.to_track_quat('Z', 'Y')
        o.location = p
        o.scale = (0.8, 0.8, 0.8)
        out.append((o, p.copy()))
    return out


def cargo_blob(centre, radius, seed, mats, idx):
    """
    The condensed nucleic acid inside a micelle, as a folded blob.

    Metaballs, not a visible strand: at this scale a real molecule reads as a
    lumpy fused mass — a space-filling surface over a folded chain — and that
    is what the reference render shows. Drawing an explicit backbone with
    nucleotides here looked like a diagram sitting inside a picture.
    """
    rnd = random.Random(seed)
    mb = bpy.data.metaballs.new(f'blobdata{idx}')
    mb.resolution = 0.045
    mb.render_resolution = 0.022
    obj = bpy.data.objects.new(f'blob{idx}', mb)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = centre
    obj.data.materials.append(mats['blob'])

    # Elements walk a short folded path, so the blob has lobes and a waist
    # rather than being a lumpy ball.
    p = Vector((0.0, 0.0, 0.0))
    v = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
    for i in range(24):
        v = (v + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.9).normalized()
        p = p + v * radius * 0.30
        if p.length > radius:
            p = p.normalized() * radius
        e = mb.elements.new()
        e.co = p
        e.radius = radius * rnd.uniform(0.38, 0.62)
    return obj


def build_micelles(me, mats):
    """
    Inverted micelles: lipid head groups turned inward around a condensed
    nucleic acid core, which is how the cargo is actually held.
    """
    lipids = []
    cargo = []
    for i, c in enumerate(micelle_sites(MICELLE_COUNT, SEED + 41)):
        lipids += build_leaflet(
            me, mats, MICELLE_LIPIDS, MICELLE_R, False, SEED + 50 + i,
            f'mic{i}', centre=c, mat_key='micelle', scale=0.82)
        cargo.append(cargo_blob(c, MICELLE_CARGO_R, SEED + 90 + i, mats, i))
    return lipids, cargo


def condensed_guide(radius=0.46, steps=170, seed=SEED + 11):
    """
    The path the packed strand follows: a smooth random walk kept inside the
    core, so the molecule folds back on itself the way a condensed one does
    rather than tracing a tidy geometric coil.
    """
    rnd = random.Random(seed)
    pts = []
    p = Vector((0.0, 0.0, 0.0))
    v = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))).normalized()
    limit = radius
    for i in range(steps):
        jitter = Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * 0.55
        v = (v + jitter).normalized()
        # Steer back toward the middle as it approaches the wall, so it stays
        # packed without clipping through the inner leaflet.
        if p.length > limit * 0.6:
            v = (v - p.normalized() * (p.length / limit) * 0.85).normalized()
        p = p + v * (radius * 0.135)
        if p.length > limit:
            p = p.normalized() * limit
        pts.append(p.copy())
    # Smooth it, or the winding follows every kink of the walk.
    for _ in range(4):
        pts = [pts[0]] + [(pts[i - 1] + pts[i] * 2 + pts[i + 1]) / 4
                          for i in range(1, len(pts) - 1)] + [pts[-1]]
    return pts


def cargo_curves(mats):
    strand, nucs = nucleic_strand('cargo', condensed_guide(), mats,
                                  backbone_r=0.020, every=3)
    return [strand], nucs


def helix(mats):
    """
    The strand released at the end. Named for the shot, not the geometry: it is
    a long backbone with nucleotides along it, undulating gently so it has some
    life without pretending to be a double helix.
    """
    guide = []
    n = 220
    for i in range(n):
        t = i / (n - 1)
        guide.append(Vector((t * STRAND_LEN,
                             math.sin(t * math.pi * 3.1) * STRAND_WAVE,
                             math.sin(t * math.pi * 2.0) * STRAND_WAVE * 0.55)))
    backbone, nucs = nucleic_strand('strand', guide, mats,
                                    backbone_r=BACKBONE_R, every=NUC_EVERY)
    backbone.data.bevel_factor_end = 0.0
    return backbone, nucs


def build_world():
    w = bpy.data.worlds.new('w')
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    # The page's own ground. film_transparent hides the background from the
    # render but anything transmissive still refracts it, so a neutral studio
    # world makes glassy surfaces read as bright discs once composited.
    bg.inputs['Color'].default_value = GROUND
    bg.inputs['Strength'].default_value = 1.0


def build_lights():
    # Nothing on the camera axis behind the subject: a transmissive sphere is a
    # lens, and a back light there refracts straight into the lens as a white
    # disc. Every light is well off axis.
    specs = [
        ('key',  520, 6.0, (-4.0, -4.0, 3.2), (1.0, 0.95, 0.88)),
        ('rim',  700, 4.5, (4.5, 2.4, 1.8),   (0.5, 0.74, 1.0)),
        ('fill', 150, 7.0, (2.6, -4.0, -3.0), (0.7, 0.85, 1.0)),
        ('top',  260, 4.0, (-1.0, 1.5, 5.0),  (0.8, 0.9, 1.0)),
    ]
    for name, energy, size, loc, colour in specs:
        d = bpy.data.lights.new(name, type='AREA')
        d.energy = energy
        d.size = size
        d.color = colour
        o = bpy.data.objects.new(name, d)
        bpy.context.scene.collection.objects.link(o)
        o.location = loc
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = (-Vector(loc)).to_track_quat('-Z', 'Y')


def build_camera():
    cd = bpy.data.cameras.new('cam')
    cd.lens = 90
    cd.dof.use_dof = True
    cd.dof.focus_distance = 6.0
    cd.dof.aperture_fstop = 8.0
    cam = bpy.data.objects.new('cam', cd)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (0, -6.0, 0)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    bpy.context.scene.camera = cam
    return cam


def build():
    clear()
    build_world()
    build_lights()

    mats = {
        'lipid_out': principled('lipid_out', **{
            'Base Color': C_HEAD_OUT, 'Roughness': 0.38, 'Subsurface Weight': 0.15}),
        'lipid_in': principled('lipid_in', **{
            'Base Color': C_HEAD_IN, 'Roughness': 0.34}),
        'ionizable': principled('ionizable', **{
            'Base Color': C_IONIZABLE, 'Roughness': 0.30}),
        # Violet. The one colour here that is not from the site palette, and
        # it earns its place: with the micelles in the same blue family as the
        # shell the interior read as an undifferentiated mass and the
        # structure was invisible.
        # Pale and neutral, as in the reference: the condensed cargo reads as a
        # molecular surface, and the warm amber is saved for the strand that
        # actually comes out at the end.
        'blob': blob_material('blob'),
        'micelle': principled('micelle', **{
            'Base Color': srgb('#8f7fd4'), 'Roughness': 0.32}),
        'cargo': principled('cargo', **{
            'Base Color': C_CARGO, 'Roughness': 0.26,
            'Subsurface Weight': 0.25, 'Subsurface Radius': (0.5, 0.2, 0.06),
            'Emission Color': C_BASE, 'Emission Strength': 0.05}),
        'base': principled('base', **{
            'Base Color': C_BASE, 'Roughness': 0.34}),
        # Four bases. Distinct enough to read as a sequence, all within the
        # site's warm range so the particle does not turn into a paint chart.
        'nuc_a': principled('nuc_a', **{
            'Base Color': srgb('#ffd9a0'), 'Roughness': 0.34}),
        'nuc_u': principled('nuc_u', **{
            'Base Color': srgb('#e8743a'), 'Roughness': 0.34}),
        'nuc_g': principled('nuc_g', **{
            'Base Color': srgb('#fff2d8'), 'Roughness': 0.34}),
        'nuc_c': principled('nuc_c', **{
            'Base Color': srgb('#c4381c'), 'Roughness': 0.34}),
    }

    me = lipid_mesh('lipid')
    me.materials.append(mats['lipid_out'])

    parts = {'mats': mats}
    parts['outer'] = build_leaflet(me, mats, LIPID_COUNT_OUT, R_OUT, True, SEED, 'lo')
    parts['inner'] = build_leaflet(me, mats, LIPID_COUNT_IN, R_IN, False, SEED + 3, 'li')
    parts['micelle'], parts['cargo'] = build_micelles(me, mats)
    parts['micelle'] += build_interstitial(me, mats)
    parts['helix'], parts['bases'] = helix(mats)
    parts['helix'].hide_render = True
    for o, _ in parts['bases']:
        o.hide_render = True
    return parts


# ---- Posing ---------------------------------------------------------------
CUT_NORMAL = Vector((0.38, -0.78, 0.46)).normalized()


def _cut_lipids(parts, cut, q):
    """
    Hide every lipid on the near side of the cut plane.

    The test is on world position against a plane, so it applies equally to the
    outer shell, the inner leaflet and the micelles — which sit off-centre and
    would be cut wrongly by a direction test.
    """
    plane = cut * R_OUT
    for key in ('outer', 'inner', 'micelle'):
        for o, pos in parts[key]:
            o.hide_render = (q @ pos).dot(CUT_NORMAL) > plane


def pose_section(parts, cut, spin):
    """
    `cut` is where the section plane sits, in units of the outer radius.

    0.2 is about half the sphere removed, which is where the opening frame
    sits; 1.25 removes nothing. Animating it outward closes the cross-section
    into a whole particle.
    """
    q = Quaternion((0, 0, 1), spin)
    _cut_lipids(parts, cut, q)
    plane = cut * R_OUT
    for o in parts['cargo']:
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = q
        o.scale = (1.0, 1.0, 1.0)
        # Cargo is cut with its micelle rather than hanging in the opening.
        o.hide_render = (q @ o.location).dot(CUT_NORMAL) > plane + MICELLE_R
    parts['helix'].hide_render = True
    for o, _ in parts['bases']:
        o.hide_render = True


def pose_release(parts, open_amount, unspool, spin):
    """The shell parts along the same plane and one strand comes out of the gap."""
    q = Quaternion((0, 0, 1), spin)
    cut = 1.25 - open_amount * 1.75
    _cut_lipids(parts, cut, q)

    # One micelle gives up its cargo; the rest stay packed. Emptying all of
    # them left the interior bare at exactly the moment the camera is closest.
    plane = cut * R_OUT
    for i, o in enumerate(parts['cargo']):
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = q
        sc = max(0.02, 1.0 - unspool * 1.15) if i == 0 else 1.0
        o.scale = (sc, sc, sc)
        o.hide_render = (q @ o.location).dot(CUT_NORMAL) > plane + MICELLE_R

    h = parts['helix']
    h.hide_render = unspool <= 0.005
    h.data.bevel_factor_end = unspool
    h.rotation_mode = 'QUATERNION'
    h.rotation_quaternion = Quaternion((0, 0, 1), -0.30)
    h.location = (0.15, 0.0, 0.0)
    # The nucleotides ride the backbone; all that changes is how many have
    # emerged, which tracks the same value revealing the backbone itself.
    for o, t in parts['bases']:
        o.hide_render = unspool <= 0.005 or t > unspool


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--shot', default='section')
    ap.add_argument('--frames', type=int, default=24)
    ap.add_argument('--res', type=int, default=800)
    ap.add_argument('--samples', type=int, default=56)
    ap.add_argument('--out', default='blender/out')
    a = ap.parse_args(argv)

    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = 'GPU'
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.render.resolution_x = a.res
    scene.render.resolution_y = a.res
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    # AgX, Blender's default, deliberately desaturates and rolls off highlights.
    # For a stylised object that has to sit on a saturated navy page it just
    # washes everything toward white.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'

    parts = build()
    build_camera()
    os.makedirs(a.out, exist_ok=True)

    import time
    t0 = time.time()
    for i in range(a.frames):
        t = i / max(1, a.frames - 1) if a.frames > 1 else 0.0
        if a.shot == 'section':
            # Open cross-section, closing to a whole sphere.
            cut = 0.20 + t * 1.05
            pose_section(parts, cut, spin=t * 0.55)
        elif a.shot == 'travel':
            pose_section(parts, cut=1.4, spin=t * math.pi * 2)
        else:
            pose_release(parts,
                         open_amount=min(1.0, t * 1.5),
                         unspool=max(0.0, (t - 0.22) / 0.78),
                         spin=0.2)
        scene.render.filepath = os.path.join(a.out, f'{a.shot}_{i:03d}.png')
        bpy.ops.render.render(write_still=True)
        print(f'FRAME {i + 1}/{a.frames} {time.time() - t0:.0f}s')
    print('SHOT_DONE', a.shot, f'{time.time() - t0:.0f}s')


main()
