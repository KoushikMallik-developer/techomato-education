// The pass/fail rules for the setup check shown before a proctored exam. Pure, so it can be unit-tested.
export const DARK = 25; // mean brightness (0-255) below this is a covered or dead camera
export const LIGHT_MIN = 50, LIGHT_MAX = 225, FACE_LIGHT_MIN = 45; // the picture, and the face inside it, must sit in this range

// f: {ready, mean, faces, size, cx, faceLuma, turned}  size/cx are fractions of the frame width; env: {mic, oneScreen}
// Returns one line per requirement: {key, ok, text}. The student may start only when every line is ok.
export function judge(f, env) {
  const camera = f.ready && f.mean >= DARK;
  const lighting = !camera ? 'Fix the camera first.'
    : f.mean < LIGHT_MIN ? 'Too dark: turn on a light or face a window.'
    : f.mean > LIGHT_MAX ? 'Too bright: reduce the light shining into the camera.'
    : f.faceLuma != null && f.faceLuma < FACE_LIGHT_MIN ? 'Your face is in shadow: do not sit with a window or lamp behind you.' : null;
  const face = !camera ? 'Fix the camera first.' : f.faces === 0 ? 'No face found: look at the camera.' : f.faces > 1 ? 'More than one face: only you may be in view.' : null;
  const place = f.faces !== 1 ? 'Waiting for your face.'
    : f.size < 0.15 ? 'Move closer to the camera.' : f.size > 0.7 ? 'Move back a little.'
    : f.cx < 0.2 || f.cx > 0.8 ? 'Center your face in the picture.' : f.turned > 0.5 ? 'Face the screen.' : null;
  const line = (key, problem, good) => ({ key, ok: !problem, text: problem || good });
  return [
    line('camera', camera ? null : 'The camera shows a black picture: uncover it, or check that it is the right camera.', 'Camera is working'),
    line('lighting', lighting, 'Lighting is good'),
    line('face', face, 'One face detected'),
    line('place', place, 'Face is centered and facing the screen'),
    line('mic', env.mic ? null : 'Microphone is off or muted: turn it on.', 'Microphone is working'),
    line('screen', env.oneScreen ? null : 'A second screen is connected: disconnect it or set it to mirror.', 'One screen'),
  ];
}
