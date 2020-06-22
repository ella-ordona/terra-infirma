import * as THREE from 'three';
import * as Tone from 'tone';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/examples/jsm/libs/dat.gui.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Sky } from './js/shaders/skyShader.js';

let camera, scene, renderer,
    controls, clock,
    mouse, raycaster,
    spotlight, hemilight;

let sky, sunSphere;

let mixers = [];

let actions = {};

const models = ['/assets/models/clamshell.gltf', 'kalabaw.gltf',
                'l-wind-rail.gltf', 'r-wind-rail.gltf', 'room.gltf', 'screen.gltf',
                'shelf.gltf', 'sofa.gltf', 'vine.gltf'];

const root = "Bb4";

const melody = ["G4", "A4", "Bb4", "D5", "F#5", "G5"];

const highMelody = ["G5", "A5", "Bb5", "D6", "G6"];

let highlightSynth;

const transpose = (freq, semitones) => {
  return Tone.Frequency(freq).transpose(semitones);
}

const harmonize = (freq, semitones) => {
  return Tone.Frequency(freq).harmonize([0, 3, 7]);
}

init();

function createDrone() {


  Tone.Master.volume.value = -35;

  const chorus = new Tone.Chorus(2, 2.5, 0.5).toMaster();
  const reverb = new Tone.Freeverb().toMaster();
  const phaser = new Tone.Phaser(0.2).toMaster();
  const autoWah = new Tone.AutoWah().toMaster();

  const noise = new Tone.Noise("brown").start();
  noise.volume.value = 9;
  const noiseAutoFilter = new Tone.AutoFilter({
    frequency: "8m",
    min: 800,
    max: 15000
  }).toMaster();
  noise.connect(noiseAutoFilter);
  noiseAutoFilter.start();

  const noiseVolumeLfo = new Tone.LFO("10m", 8, 10);
  noiseVolumeLfo.start();
  noiseVolumeLfo.connect(noise.volume);

  //Subtly modulate the reverb
  const reverbRoomSizeLfo = new Tone.LFO("7m", 0.7, 0.9);
  reverbRoomSizeLfo.start();
  reverbRoomSizeLfo.connect(reverb.roomSize);

  //Subtly modulate the reverb
  const reverbDampeningLfo = new Tone.LFO("6m", 1000, 4000);
  reverbDampeningLfo.start();
  reverbDampeningLfo.connect(reverb.dampening);

  initSynth();
  initOsc();
}

function initSynth() {
  var synth = new Tone.Synth({
        oscillator: {
          type: "square" + 4
        },
        envelope: {
          attack: 0.02,
          decay: 0.75,
          sustain: 1,
          release: 2
        }
      }).toMaster();

  synth.volume.value = 9;

  // var melody = ["G4","A4","Bb4","C5","D5","Eb5","F#5","G5"];


  var pattern = new Tone.Pattern(function(time, note) {
   //the order of the notes passed in depends on the pattern
   synth.triggerAttackRelease(transpose(note, -16), "2m", time);
 }, melody, "randomOnce");

   pattern.interval = "2m";
   pattern.start(12);

   var tempo = 70;
   Tone.Transport.bpm.value = tempo;
   Tone.Transport.start("+0.1");

}

function initOsc() {
  const fmOsc2 = new Tone.FMOscillator(transpose(root, -12), "sine", "square").toMaster().start(10);
  const oscRootO3 = new Tone.FMOscillator(transpose(root, -24), "square4", "square").toMaster().start(0.5);

  const osc1 = new Tone.FMOscillator(transpose("G4", -12), "sine", "square").toMaster().start(0.5);
  const osc2 = new Tone.FMOscillator(transpose("Bb4", -12), "sine", "square").toMaster().start(0.5);
  const osc3 = new Tone.FMOscillator(transpose("D5", -12), "sine", "square").toMaster().start(0.5);
}

function createHighlightSynth() {
  highlightSynth = new Tone.Synth({
        oscillator: {
          type: "fatsine",
          harmonicity: 0.5,
        },
        envelope: {
          // attackCurve: "ripple",
          releaseCurve: "ripple",
          attack: 0.04,
          decay: 1,
          sustain: 1,
          release: 2
        }
      }).toMaster();
  highlightSynth.volume.value = 30;
  //set the attributes using the set interface
  highlightSynth.set("detune", -1200);
}

function createSky() {

  // Add Sky
  sky = new Sky();
  sky.scale.setScalar( 450000 );
  scene.add( sky );

  // Add Sun Helper
  sunSphere = new THREE.Mesh(
  new THREE.SphereBufferGeometry( 20000, 16, 8 ),
  new THREE.MeshBasicMaterial( { color: 0xffffff } )
  );
  sunSphere.position.y = - 700000;
  sunSphere.visible = false;
  scene.add( sunSphere );

  /// GUI

  var effectController = {
  turbidity: 10,
  rayleigh: 2,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  luminance: 1,
  inclination: 0.49, // elevation / inclination
  azimuth: 0.25, // Facing front,
  refractiveIndex: 1.000317,
  numMolecules: 2.542e+25,
  depolarizationFactor: 0.067,
  rayleighZenithLength: 615,
  // mieKCoefficient: [0.686, 0.678, 0.666],
  mx: 0.686,
  my: 0.678,
  mz: 0.666,
  mieV: 4,
  mieZenithLength: 500,
  sunIntensityFactor: 1111,
  sunIntensityFalloffSteepness: 0.98,
  sunAngularDiameterDegrees: 0.00758,
  tonemapWeighting: 9.50,
  // primaries: [6.8e-7, 5.5e-7, 4.5e-7],
  px: 6.8e-7,
  py: 5.5e-7,
  pz: 4.5e-7,
  sun: ! true
  };

  var distance = 400000;

  function guiChanged() {

  var uniforms = sky.material.uniforms;
  uniforms[ "turbidity" ].value = effectController.turbidity;
  uniforms[ "rayleigh" ].value = effectController.rayleigh;
  uniforms[ "mieCoefficient" ].value = effectController.mieCoefficient;
  uniforms[ "mieDirectionalG" ].value = effectController.mieDirectionalG;
  uniforms[ "luminance" ].value = effectController.luminance;
  uniforms[ "refractiveIndex" ].value = effectController.refractiveIndex;
  uniforms[ "numMolecules" ].value = effectController.numMolecules;
  uniforms[ "mieZenithLength" ].value = effectController.mieZenithLength
  uniforms[ "mieV" ].value = effectController.mieV;
  uniforms[ "sunIntensityFactor" ].value = effectController.sunIntensityFactor;
  uniforms[ "sunIntensityFalloffSteepness" ].value = effectController.sunIntensityFalloffSteepness;
  uniforms[ "sunAngularDiameterDegrees" ].value = effectController.sunAngularDiameterDegrees;
  uniforms[ "tonemapWeighting" ].value = effectController.tonemapWeighting;
  uniforms[ "primaries"].value.x = effectController.px;
  uniforms[ "primaries"].value.y = effectController.py;
  uniforms[ "primaries"].value.z = effectController.pz;
  uniforms[ "mieKCoefficient" ].value.x = effectController.mx;
  uniforms[ "mieKCoefficient" ].value.y = effectController.my;
  uniforms[ "mieKCoefficient" ].value.z = effectController.mz;




  var theta = Math.PI * ( effectController.inclination - 0.5 );
  var phi = 2 * Math.PI * ( effectController.azimuth - 0.5 );

  sunSphere.position.x = distance * Math.cos( phi );
  sunSphere.position.y = distance * Math.sin( phi ) * Math.sin( theta );
  sunSphere.position.z = distance * Math.sin( phi ) * Math.cos( theta );

  sunSphere.visible = effectController.sun;

  uniforms[ "sunPosition" ].value.copy( sunSphere.position );

  }

  var gui = new GUI();

  gui.add( effectController, "turbidity", 1.0, 20.0, 0.1 ).onChange( guiChanged );
  gui.add( effectController, "rayleigh", 0.0, 10, 0.001 ).onChange( guiChanged );
  gui.add( effectController, "mieCoefficient", 0.0, 0.1, 0.001 ).onChange( guiChanged );
  gui.add( effectController, "mieDirectionalG", 0.0, 1, 0.001 ).onChange( guiChanged );
  gui.add( effectController, "luminance", 0.0, 2 ).onChange( guiChanged );
  gui.add( effectController, "inclination", 0, 1, 0.0001 ).onChange( guiChanged );
  gui.add( effectController, "azimuth", 0, 1, 0.0001 ).onChange( guiChanged );
  gui.add( effectController, "refractiveIndex", 1, 2, 0.0001 ).onChange( guiChanged );
  gui.add( effectController, "numMolecules", 0, 3, 0.1 ).onChange( guiChanged );
  gui.add( effectController, "depolarizationFactor", 0, 1, 0.1 ).onChange( guiChanged );
  gui.add( effectController, "rayleighZenithLength", 100, 200000, 100 ).onChange( guiChanged );
  gui.add( effectController, "mieV", 3, 4, .01 ).onChange( guiChanged );
  gui.add( effectController, "mieZenithLength", 500, 34000, 100 ).onChange( guiChanged );
  gui.add( effectController, "sunIntensityFactor", 1000, 2500, 100 ).onChange( guiChanged );
  gui.add( effectController, "sunIntensityFalloffSteepness", .75, 2.25, .25 ).onChange( guiChanged );
  gui.add( effectController, "sunAngularDiameterDegrees", 0.009, .01, .05 ).onChange( guiChanged );

  gui.add( effectController, "sun" ).onChange( guiChanged );

  gui.add(effectController, "px", 6.8e-7, 8e-7, 0.1e-7).onChange( guiChanged );
  gui.add(effectController, "py", 3.766e-7, 5.5e-7, 0.3e-7).onChange( guiChanged );
  gui.add(effectController, "pz", 3.172e-7, 5.1e-7, 0.3e-7).onChange( guiChanged );
  gui.add(effectController, "mx", 0.686, 1, 0.1).onChange( guiChanged );
  gui.add(effectController, "my", 0.678, 1, 0.1).onChange( guiChanged );
  gui.add(effectController, "mz", 0.666, 1, 0.3e-7).onChange( guiChanged );


  guiChanged();

}

function createCamera() {
  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 500000 );
  camera.position.set( 0, 7, 0);
  camera.lookAt(new THREE.Vector3(0,0,0)); // Set look at coordinate like this

}

function createEnvMap() {

  new RGBELoader()
    .setDataType( THREE.UnsignedByteType )
    .load( './assets/env/venice_sunset_1k.hdr', function ( hdrEquirect ) {
      var pmremGenerator = new THREE.PMREMGenerator( renderer );
      pmremGenerator.compileEquirectangularShader();

      var hdrCubeRenderTarget = pmremGenerator.fromEquirectangular( hdrEquirect );

      hdrCubeRenderTarget.texture.format = THREE.RGBFormat;
      hdrCubeRenderTarget.encoding = THREE.sRGBEncoding;
      hdrEquirect.dispose();
      pmremGenerator.dispose();
      // scene.background = hdrCubeRenderTarget.texture;
      scene.environment = hdrCubeRenderTarget.texture;
      renderer.toneMappingExposure = 1.25;

    } );

}

function createModels() {
  var loader = new GLTFLoader();
  var filename;

  models.forEach(function(model) {
    loader.load( './assets/models/' + model, function ( gltf ) {
      var model = gltf.scene;
      // console.log(gltf.scene);
      model.scale.set(3, 3, 3);


      model.traverse((obj) => {
        if (obj.castShadow !== undefined) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }



          //keep in case of texture mapping later
          // var materials = Array.isArray(node.material);
          // console.log(materials)
          //
          // if (materials.map) {
          //   materials.map.encoding = THREE.sRGBEncoding;
          //   materials.map.anisotropy = 16;
          // }
          // if (materials.emissiveMap) materials.emissiveMap.encoding = THREE.sRGBEncoding;

      });

      scene.add( model );
      // action = mixer.clipAction( gltf.animations[0] );
      // action.setLoop( THREE.LoopOnce );


    }, undefined, function ( error ) {

       console.error( error );

     });
   });
}

function createLights() {
  hemilight = new THREE.HemisphereLight( 0xffeeb1, 0x080820, 4 );
  scene.add( hemilight );

  spotlight = new THREE.SpotLight( 0xffa95c, 2);
  spotlight.castShadow = true;
  spotlight.shadow.bias = -0.004;
  spotlight.shadow.mapSize.width = 1024*4;
  spotlight.shadow.mapSize.height = 1024*4;
  scene.add( spotlight );
}

function createRendererAndControls() {
  renderer = new THREE.WebGLRenderer();
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.Uncharted2ToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  controls = new OrbitControls( camera, renderer.domElement );
  //controls.maxPolarAngle = Math.PI / 2;
  // controls.enableZoom = false;
  // controls.enablePan = false;

  window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {
  requestAnimationFrame(animate);

  var delta = clock.getDelta();

  controls.update();

  render();
}

function render() {

  renderer.render( scene, camera );
}


function init() {
  createHighlightSynth();
  createDrone();

  //clock for animation
  clock = new THREE.Clock();

  //scene vars
  scene = new THREE.Scene();

  // scene.background = new THREE.Color( 0xffffff );
  scene.fog = new THREE.Fog(0xC497F7, 0.1, 35);


  //raycaster vars for intersections
  raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
  window.addEventListener( 'click', onClick, false );


  createCamera();
  createEnvMap();
  createModels();
  createLights();
  createSky();
  createRendererAndControls();

  animate();
};

function onClick( event ) {
  if (Tone.context.state !== 'running') {
    Tone.context.resume();
  }

	event.preventDefault();

	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

	raycaster.setFromCamera( mouse, camera );

	var intersects = raycaster.intersectObjects( scene.children, true );

	if ( intersects.length > 0) {

    //if object clicked on is mesh, get name and run check animation function
    if (intersects[ 0 ].object.type == 'Mesh' || intersects[ 0 ].object.type == 'SkinnedMesh') {
      highlightSynth.triggerAttackRelease(highMelody[Math.floor(Math.random() * highMelody.length)], "16n");

    }
	}

}

function checkAndPlay(objName) {
  //if hospital-bed: new function for fireflies

  //if object name in mixer list children name, play animation


  mixers.forEach(function(mixer) {
    let root = mixer.getRoot();

    if (root.children[0].name === objName){
      let action = actions[objName];
      action.stop();
      action.play();

    }
  });
}
