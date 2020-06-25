/**
 * @author zz85 / https://github.com/zz85
 *
 * Based on "A Practical Analytic Model for Daylight"
 * aka The Preetham Model, the de facto standard analytic skydome model
 * http://www.cs.utah.edu/~shirley/papers/sunsky/sunsky.pdf
 *
 * First implemented by Simon Wallner
 * http://www.simonwallner.at/projects/atmospheric-scattering
 *
 * Improved by Martin Upitis
 * http://blenderartists.org/forum/showthread.php?245954-preethams-sky-impementation-HDR
 *
 * Three.js integration by zz85 http://twitter.com/blurspline
*/

import {
	BackSide,
	BoxBufferGeometry,
	Mesh,
	ShaderMaterial,
	UniformsUtils,
	Vector3
} from "three/build/three.module.js";

function randIntGen (min, max, divisor) {
  min = Math.ceil(min);
  max = Math.floor(max);
  let int;
  if (divisor == 1) {
    int = Math.floor(Math.random() * (max - min + 1)) + min;
  } else {
    int = (Math.random() * (max - min + 1) + min)/divisor;

  }
  // console.log(int);
  return int;
}

var Sky = function () {

	var shader = Sky.SkyShader;

	var material = new ShaderMaterial( {
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader,
		uniforms: UniformsUtils.clone( shader.uniforms ),
		side: BackSide,
		depthWrite: false
	} );

	Mesh.call( this, new BoxBufferGeometry( 1, 1, 1 ), material );

};

Sky.prototype = Object.create( Mesh.prototype );

Sky.SkyShader = {
//
	uniforms: {
		"luminance": { value: randIntGen( 1, 10, 1  ) },
		"turbidity": { value: randIntGen( 1, 10, 1 ) },
		"rayleigh": { value: randIntGen( 1, 10, 1 ) },
		"mieCoefficient": { value: randIntGen( 0, 1, 10) },
		"mieDirectionalG": { value: randIntGen( 0, 1, 10  ) },
		"sunPosition": { value: new Vector3() },
    "mieV": { value: randIntGen( 0, 1, 10) + 3 },
		"up": { value: new Vector3( 0, 1, 0 ) },
		"cameraPos": { value: new Vector3() },
		"refractiveIndex": { value: 1.0003 },
		"numMolecules": { value: 2.542e25 },
		"depolarizationFactor": { value: 0.035 },
		"primaries": { value: new Vector3() },
		"mieKCoefficient": { value: new Vector3( randIntGen(686, 1000, 1)/1000, randIntGen(686, 1000, 1)/1000, randIntGen(686, 1000, 1)/1000 ) },
		"mieV": { value: 4.0 },
		"rayleighZenithLength": { value: 8.4e3 },
		"mieZenithLength": { value: (randIntGen( 5, 340, 1 ) * 100) },
		"sunIntensityFactor": { value: (randIntGen( 10, 25, 1 ) * 100) },
		"sunIntensityFalloffSteepness": { value: 1.5 },
		"sunAngularDiameterDegrees": { value: 0.0093333 },
		"tonemapWeighting": { value: 9.50 }
	},

	vertexShader: [

    'varying vec3 vWorldPosition;',

    'void main() {',
  	'vec4 worldPosition = modelMatrix * vec4(position, 1.0);',
  	'vWorldPosition = worldPosition.xyz;',
  	'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'


	].join( '\n' ),

	fragmentShader: [
    'varying vec3 vWorldPosition;',

    'uniform vec3 cameraPos;',
    'uniform float depolarizationFactor;',
    'uniform float luminance;',
    'uniform float mieCoefficient;',
    'uniform float mieDirectionalG;',
    'uniform vec3 mieKCoefficient;',
    'uniform float mieV;',
    'uniform float mieZenithLength;',
    'uniform float numMolecules;',
    'uniform vec3 primaries;',
    'uniform float rayleigh;',
    'uniform float rayleighZenithLength;',
    'uniform float refractiveIndex;',
    'uniform float sunAngularDiameterDegrees;',
    'uniform float sunIntensityFactor;',
    'uniform float sunIntensityFalloffSteepness;',
    'uniform vec3 sunPosition;',
    'uniform float tonemapWeighting;',
    'uniform float turbidity;',

    'const float PI = 3.141592653589793238462643383279502884197169;',
    'const vec3 UP = vec3(0.0, 1.0, 0.0);',

    'vec3 totalRayleigh(vec3 lambda){',
      'return (8.0 * pow(PI, 3.0) * pow(pow(refractiveIndex, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * depolarizationFactor)) / (3.0 * numMolecules * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * depolarizationFactor));',
    '}',

    'vec3 totalMie(vec3 lambda, vec3 K, float T){',
      'float c = 0.2 * T * 10e-18;',
      'return 0.434 * c * PI * pow((2.0 * PI) / lambda, vec3(mieV - 2.0)) * K;',
    '}',

    'float rayleighPhase(float cosTheta){',
    'return (3.0 / (16.0 * PI)) * (1.0 + pow(cosTheta, 2.0));',
    '}',

    'float henyeyGreensteinPhase(float cosTheta, float g){',
      'return (1.0 / (4.0 * PI)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0 * g * cosTheta + pow(g, 2.0), 1.5));',
    '}',

    'float sunIntensity(float zenithAngleCos){',
      'float cutoffAngle = PI / 1.95;',
      'return sunIntensityFactor * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos)) / sunIntensityFalloffSteepness)));',
    '}',

    // Whitescale tonemapping calculation, see http://filmicgames.com/archives/75
    // Also see http://blenderartists.org/forum/showthread.php?321110-Shaders-and-Skybox-madness
    'const float A = 0.15;', // Shoulder strength
    'const float B = 0.50;', // Linear strength
    'const float C = 0.10;', // Linear angle
    'const float D = 0.20;', // Toe strength
    'const float E = 0.02;', // Toe numerator
    'const float F = 0.30;', // Toe denominator
    'vec3 Uncharted2Tonemap(vec3 W){',
      'return ((W * (A * W + C * B) + D * E) / (W * (A * W + B) + D * F)) - E / F;',
    '}',

    'void main(){',
      // Rayleigh coefficient
      'float sunfade = 1.0 - clamp(1.0 - exp((sunPosition.y / 450000.0)), 0.0, 1.0);',
      'float rayleighCoefficient = rayleigh - (1.0 * (1.0 - sunfade));',
      'vec3 betaR = totalRayleigh(primaries) * rayleighCoefficient;',

      // Mie coefficient
      'vec3 betaM = totalMie(primaries, mieKCoefficient, turbidity) * mieCoefficient;',

      // Optical length, cutoff angle at 90 to avoid singularity
      'float zenithAngle = acos(max(0.0, dot(UP, normalize(vWorldPosition - cameraPos))));',
      'float denom = cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / PI), -1.253);',
      'float sR = rayleighZenithLength / denom;',
      'float sM = mieZenithLength / denom;',

      // Combined extinction factor
      'vec3 Fex = exp(-(betaR * sR + betaM * sM));',

      // In-scattering
      'vec3 sunDirection = normalize(sunPosition);',
      'float cosTheta = dot(normalize(vWorldPosition - cameraPos), sunDirection);',
      'vec3 betaRTheta = betaR * rayleighPhase(cosTheta * 0.5 + 0.5);',
      'vec3 betaMTheta = betaM * henyeyGreensteinPhase(cosTheta, mieDirectionalG);',
      'float sunE = sunIntensity(dot(sunDirection, UP));',
      'vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex), vec3(1.5));',
      'Lin *= mix(vec3(1.0), pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex, vec3(0.5)), clamp(pow(1.0 - dot(UP, sunDirection), 5.0), 0.0, 1.0));',

      // Composition + solar disc
      'float sunAngularDiameterCos = cos(sunAngularDiameterDegrees);',
      'float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);',
      'vec3 L0 = vec3(0.1) * Fex;',
      'L0 += sunE * 19000.0 * Fex * sundisk;',
      'vec3 texColor = Lin + L0;',
      'texColor *= 0.04;',
      'texColor += vec3(0.0, 0.001, 0.0025) * 0.3;',

      // Tonemapping
      'vec3 whiteScale = 1.0 / Uncharted2Tonemap(vec3(tonemapWeighting));',
      'vec3 curr = Uncharted2Tonemap((log2(2.0 / pow(luminance, 4.0))) * texColor);',
      'vec3 color = curr * whiteScale;',
      'vec3 retColor = pow(color, vec3(1.0 / (1.2 + (1.2 * sunfade))));',

      'gl_FragColor = vec4(retColor, 1.0);',
    '}'
	].join( '\n' )

};

export { Sky };
