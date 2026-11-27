"""The coffee2 pour, simulated and rendered offline in Blender (Mantaflow FLIP + Cycles).

Run (from the repo root):
  blender -b -P assets/coffee2/scene.py -- --out <work dir> [--draft] [--bake] [--render] [--frames 1-240] [--step 1]

Ric, 2026-11-27: "it needs to look crazy realistic on a computer screen which in reality
your right could just be a straight up video" -- so the computer plays a clip rendered here,
straight on, the screen being the front glass of a tank the coffee is poured into.

Units are metres. The tank: 0.32 wide (x), DEPTH deep (y, away from the camera, the front glass
at y = 0), 0.18 tall (z). A 16:9 screen is the front glass. The cache and the frames go in the
work dir, never the repo.
"""
import bpy, sys, os, math, argparse

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--draft", action="store_true")
ap.add_argument("--bake", action="store_true")
ap.add_argument("--render", action="store_true")
ap.add_argument("--frames", default="1-240")
ap.add_argument("--step", type=int, default=1)
ap.add_argument("--res", type=int, default=0)          # simulation resolution override
ap.add_argument("--samples", type=int, default=0)
ap.add_argument("--width", type=int, default=0)
ap.add_argument("--radius", type=float, default=0.01)
ap.add_argument("--speed", type=float, default=1.0)
ap.add_argument("--end", type=int, default=240)
a = ap.parse_args(argv)
f0, f1 = (int(x) for x in a.frames.split("-"))

W, H, DEPTH = 0.32, 0.18, 0.07
FPS = 30
POUR_END = 150            # frames: the jug pours for five seconds, then stops
END = a.end

out = os.path.abspath(a.out)
os.makedirs(out, exist_ok=True)

# ---- a clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, END
sc.unit_settings.system = "METRIC"


def box(name, x0, x1, y0, y1, z0, z1):
    bpy.ops.mesh.primitive_cube_add(location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.active_object
    o.name = name
    o.scale = ((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2)
    bpy.ops.object.transform_apply(scale=True)
    return o


# ---- the domain: the tank's inside, open at the top (the domain's ceiling lets liquid out)
# The domain is a little larger than the tank, and the tank's walls are obstacles inside it:
# against the domain's own border the liquid's surface is left open, and an open surface lets
# light straight through (it rendered grey, 2026-11-27).
M = 0.012
dom = box("Coffee", -W / 2 - M, W / 2 + M, -M, DEPTH + M, -M, H + 0.06)
m = dom.modifiers.new("Fluid", "FLUID")
m.fluid_type = "DOMAIN"
ds = m.domain_settings
ds.domain_type = "LIQUID"
ds.resolution_max = a.res or (110 if a.draft else 300)
ds.use_mesh = True
ds.mesh_scale = 1 if a.draft else 2
ds.mesh_particle_radius = 1.6
ds.mesh_smoothen_pos = 1
ds.mesh_smoothen_neg = 1
ds.use_adaptive_timesteps = True
ds.cfl_condition = 3.0
ds.timesteps_max = 12
ds.particle_radius = 1.0
ds.use_flip_particles = True
ds.flip_ratio = 0.97
ds.cache_type = "ALL"
ds.cache_data_format = "OPENVDB"
ds.cache_mesh_format = "BOBJECT"
ds.cache_directory = os.path.join(out, "cache")
ds.cache_frame_start, ds.cache_frame_end = 1, END
# real size and real time: the domain's longest side is W + nothing, gravity is the scene's 9.81
# (Blender 5 has no "real world size": the domain is taken at its size in metres.)
walls = []
for name, bx in (("Front", (-W / 2 - M, W / 2 + M, -M, 0.0, -M, H + 0.06)),
                 ("Back", (-W / 2 - M, W / 2 + M, DEPTH, DEPTH + M, -M, H + 0.06)),
                 ("Left", (-W / 2 - M, -W / 2, -M, DEPTH + M, -M, H + 0.06)),
                 ("Right", (W / 2, W / 2 + M, -M, DEPTH + M, -M, H + 0.06)),
                 ("Floor", (-W / 2 - M, W / 2 + M, -M, DEPTH + M, -M, 0.0))):
    o = box(name, *bx)
    em = o.modifiers.new("Fluid", "FLUID")
    em.fluid_type = "EFFECTOR"
    em.effector_settings.effector_type = "COLLISION"
    em.effector_settings.use_effector = True
    o.hide_render = True
    walls.append(o)
for side in ("use_collision_border_front", "use_collision_border_back", "use_collision_border_left",
             "use_collision_border_right", "use_collision_border_bottom"):
    setattr(ds, side, True)
ds.use_collision_border_top = False
# coffee is water, near enough: viscosity of water at 70 C is about 0.4 mPa s; the solver's
# own numerical viscosity is far above that at this resolution, so it is left inviscid
try:
    ds.use_viscosity = False
except Exception:
    pass

# ---- the jug's stream: a cylinder above the tank, a little right of centre, pouring down
bpy.ops.mesh.primitive_cylinder_add(radius=a.radius, depth=0.03, location=(0.04, DEPTH * 0.5, H + 0.035))
jug = bpy.context.active_object
jug.name = "Pour"
fm = jug.modifiers.new("Fluid", "FLUID")
fm.fluid_type = "FLOW"
fs = fm.flow_settings
fs.flow_type = "LIQUID"
fs.flow_behavior = "INFLOW"
fs.flow_source = "MESH"
fs.use_initial_velocity = True
fs.velocity_coord = (0.0, 0.0, -a.speed)
fs.use_plane_init = False
# the pour starts at once and stops at POUR_END
fs.use_inflow = True
fs.keyframe_insert("use_inflow", frame=POUR_END - 1)
fs.use_inflow = False
fs.keyframe_insert("use_inflow", frame=POUR_END)
fs.use_inflow = True
sc.frame_set(1)

# ---- the coffee: water's surface, coffee's absorption
mat = bpy.data.materials.new("Coffee")
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
outn = nt.nodes.new("ShaderNodeOutputMaterial")
glass = nt.nodes.new("ShaderNodeBsdfGlass")
glass.inputs["IOR"].default_value = 1.335
glass.inputs["Roughness"].default_value = 0.0
glass.inputs["Color"].default_value = (1, 1, 1, 1)
absn = nt.nodes.new("ShaderNodeVolumeAbsorption")
# Beer-Lambert per metre: red 350, green 500, blue 650 (per mm 0.35 / 0.5 / 0.65, as `coffee`):
# Cycles absorbs density * (1 - colour)
dens = 700.0
absn.inputs["Density"].default_value = dens
absn.inputs["Color"].default_value = (1 - 350 / dens, 1 - 500 / dens, 1 - 650 / dens, 1)
nt.links.new(glass.outputs[0], outn.inputs["Surface"])
nt.links.new(absn.outputs[0], outn.inputs["Volume"])
dom.data.materials.append(mat)

# ---- the light: a soft window above and behind, a dimmer fill in front, a grey room.
# The tank's walls are not drawn: the screen is the front glass.
world = bpy.data.worlds.new("Room")
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.20, 0.19, 0.18, 1)
bg.inputs["Strength"].default_value = 0.6


def area(name, loc, rot, size, energy):
    bpy.ops.object.light_add(type="AREA", location=loc, rotation=rot)
    l = bpy.context.active_object
    l.name = name
    l.data.shape = "RECTANGLE"
    l.data.size, l.data.size_y = size
    l.data.energy = energy
    return l


area("Window", (0.0, 0.35, 0.45), (math.radians(-40), 0, 0), (0.9, 0.4), 260)
area("Fill", (0.0, -0.6, 0.25), (math.radians(80), 0, 0), (1.2, 0.5), 60)

# ---- the camera: straight on, the front glass filling the frame
cam_d = 1.0
bpy.ops.object.camera_add(location=(0.0, -cam_d, H / 2), rotation=(math.radians(90), 0, 0))
cam = bpy.context.active_object
sc.camera = cam
cam.data.sensor_width = 36
cam.data.sensor_fit = "HORIZONTAL"
cam.data.lens = 36 * cam_d / W          # the front glass, W wide, exactly fills the frame

# ---- render settings
r = sc.render
r.engine = "CYCLES"
r.resolution_x = a.width or (960 if a.draft else 1920)
r.resolution_y = round(r.resolution_x * 9 / 16)
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
r.filepath = os.path.join(out, "frames", "f_####")
cy = sc.cycles
cy.device = "CPU"
cy.samples = a.samples or (24 if a.draft else 128)
cy.use_denoising = True
cy.max_bounces = 16
cy.transmission_bounces = 16
cy.transparent_max_bounces = 16
cy.volume_bounces = 0
cy.caustics_refractive = False
cy.caustics_reflective = False
try:
    sc.view_settings.view_transform = "AgX"
except Exception:
    pass

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "coffee2.blend"))

if a.bake:
    with bpy.context.temp_override(object=dom, active_object=dom, selected_objects=[dom]):
        bpy.ops.fluid.bake_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "coffee2.blend"))

if a.render:
    jug.hide_render = True
    for f in range(f0, f1 + 1, a.step):
        sc.frame_set(f)
        r.filepath = os.path.join(out, "frames", "f_%04d.png" % f)
        bpy.ops.render.render(write_still=True)
