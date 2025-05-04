
uniform float time;
varying vec2 vUv;
void main() {
  vec2 grid = fract(vUv * 50.0);
  float line = step(0.98, grid.x) + step(0.98, grid.y);
  float pulse = sin(time * 2.0 + vUv.x * 10.0) * 0.5 + 0.5;
  gl_FragColor = vec4(vec3(line * pulse * 0.3), 1.0);
}
