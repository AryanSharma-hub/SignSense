# signer.glb

The 3D signer. A realistic human made with Blender and the MPFB (MakeHuman) extension,
with a Mixamo-compatible 67-bone rig (15 finger joints per hand, jaw, eyelids) and
ARKit + Oculus-viseme blend shapes.

- Source: `avatars/mpfb.glb` from https://github.com/met4citizen/TalkingHead,
  commit `2afe6d79779313db8909badebf46f9805a6c7b70`.
- License: **CC0** (public domain dedication), as stated in the TalkingHead README.
  MPFB/MakeHuman assets are CC0 / CC-BY; this exported avatar is published as CC0.

## Changes from the original (37 MB -> 5.3 MB)

Geometry, rig and blend shapes are unchanged. For the web:

1. Textures re-encoded as WebP (`EXT_texture_webp`): body, suit and hair kept at
   2048 px; the 4096 px suit normal map reduced to 2048 px; eyes and teeth to 512 px,
   tongue to 256 px.
2. Geometry compressed with glTF-Transform `meshopt` (`EXT_meshopt_compression`,
   `KHR_mesh_quantization`). Three.js decodes it with its bundled `MeshoptDecoder`.
