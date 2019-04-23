
function map_value(v, in_min, in_max, out_min, out_max) {
    return (v - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

let config = window.config || window.parent.config;
if(!config) {
    //debug/demo config
    config = {
        urlbase: "testdata", //root of where I can find /surfaces and /roipairs and labels.json
        jwt: null, //jwt to add to all urls
    }
}

/*
Vue.component('prfview', {
    name: 'prfview', 
    props: [ "config" ],
    data() {
        return {
        }
    },
    mounted() {
        console.log("prfview mounted");
    },
    template: `
        <div class="prfview">
            hello
        </div>
    `,
});
*/

new Vue({
    el: '#app',
    data: function() {
        return {
            //threejs things
            t: {
                renderer: null,
                scene: null,
                camera: null,
                controls: null,

                camera_light: null,
            },

            mesh: {
                lh: null,
                rh: null,

                cube: null, //for test
            },

            gui: {
                ui: new dat.GUI(),

                overlay: 'none',
                r2_min: 0,                  
                r2_max: 1,                  

                cortical_depth: 0,
                inflate: 0,
            },

            prf: {
                header: null, 

                r2: null,
                r2_stats: null,

                p_angle: null,
                p_angle_stats: null,

                rf_width: null,
                rf_width_stats: null,

                ecc: null,
                ecc_stats: null,
            },
               
            config,
        }
    },
    template: `
    <div>
        <div id="three" ref="three" @mousemove="mousemove" @mousedown="mousedown" @mouseup="mouseup"/>
    </div>
    `,
    
    //components: ['prfview'],
    mounted() {

        let viewbox = this.$refs.three.getBoundingClientRect();

        //camera
        this.t.camera = new THREE.PerspectiveCamera(45, viewbox.width / viewbox.height, 1, 1000);
        this.t.camera.position.z = 200;
        
        //renderer
        this.t.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.t.renderer.autoClear = false;
        this.t.renderer.setSize(viewbox.width, viewbox.height);
        this.$refs.three.appendChild(this.t.renderer.domElement);
        
        //scene
        this.t.scene = new THREE.Scene();

        //amb.light
        var ambientLight = new THREE.AmbientLight(0x505050);
        this.t.scene.add(ambientLight);

        //camera light
        this.t.camera_light = new THREE.PointLight(0xffffff, 1);
        this.t.camera_light.radius = 10;
        this.t.scene.add(this.t.camera_light);

        this.t.controls = new THREE.OrbitControls(this.t.camera, this.t.renderer.domElement);
        this.t.controls.autoRotate = true;
        this.t.controls.addEventListener('start', ()=>{
            //stop roration when user interacts
            this.t.controls.autoRotate = false;
        });

        window.addEventListener("resize", this.resized);

        this.init_gui();
        this.animate();

        this.load();
    },

    watch: {
    },

    methods: {
        init_gui() {
            let ui = this.gui.ui.addFolder('UI');
            ui.add(this.t.controls, 'autoRotate').listen();
            //ui.add(this.gui, 'show_stats');
            ui.open();

            var matrix = this.gui.ui.addFolder('Overlay');
            matrix.add(this.gui, 'overlay', [ 'none', 'r2', 'r2*polar_angle', 'r2*rf_width', 'r2*eccentricity' ]).onChange(v=>{
                console.log(v);
                this.update_color();
            });
            matrix.add(this.gui, 'r2_min', 0, 0.1).step(0.001).onChange(v=>{
                this.update_color();
            });
            matrix.add(this.gui, 'r2_max', 0, 10).onChange(v=>{
                this.update_color();
            });
            matrix.open();

            ui.add(this.gui, 'cortical_depth', 0, 1).step(0.01).onChange(v=>{
                if(!this.mesh.lh) return;
                this.mesh.lh.morphTargetInfluences[0] = v;
                this.update_color();
            });
            ui.add(this.gui, 'inflate', 0, 1).step(0.01).onChange(v=>{
                if(!this.mesh.lh) return;
                this.mesh.lh.morphTargetInfluences[1] = v;
            });
        },

        resized() {
            var viewbox = this.$refs.three.getBoundingClientRect();
            this.t.camera.aspect = viewbox.width / viewbox.height;
            this.t.camera.updateProjectionMatrix();
            this.t.renderer.setSize(viewbox.width, viewbox.height);
        },

        mousemove(event) {
        },
        mouseup(event) {
        },
        mousedown(event) {
        },

        update_color() {
            //make sure we have everything we need
            if(!this.mesh.lh) return;
            if(!this.prf.header) return;

            let geometry = this.mesh.lh.geometry;
            let color = geometry.attributes.color;
            let position = geometry.attributes.position;
            color.needsUpdate = true;
            
            //console.log("update_color");
            let v_data;
            let v_stats;
            switch(this.gui.overlay) {
            case "none":
                console.log("none!");
                for(var i = 0;i < color.count;++i) { 
                    color.setXYZ(i, 255, 255, 255); 
                }
                return;
            case "r2*polar_angle":
                v_data = this.prf.p_angle;
                v_stats = this.prf.p_angle_stats;
                break;
            case "r2*rf_width":
                v_data = this.prf.rf_width;
                v_stats = this.prf.rf_width_stats;
                break;
            case "r2*eccentricity":
                v_data = this.prf.ecc;
                v_stats = this.prf.ecc_stats;
                break;
            }

            for(var i = 0;i < color.count;++i) { 
                //get vertex coord
                let x = position.getX(i);
                let y = position.getY(i);
                let z = position.getZ(i);
                
                //convert it to voxel coords and get the value
                let vx = Math.round((x - this.prf.header.spaceOrigin[0]) / this.prf.header.thicknesses[0]);
                let vy = Math.round((y - this.prf.header.spaceOrigin[1]) / this.prf.header.thicknesses[1]);
                let vz = Math.round((z - this.prf.header.spaceOrigin[2]) / this.prf.header.thicknesses[2]);

                let r2 = this.prf.r2.get(vz, vy, vz);
                if(isNaN(r2)) {
                    color.setXYZ(i, 50, 50, 50); 
                    continue;
                }
                //TODO - the way r2/min/max is applied is wrong
                r2 = map_value(r2, this.prf.r2_stats.min, this.prf.r2_stats.max, this.gui.r2_min, this.gui.r2_max);
                //if(i % 5000 == 0) console.log(r2);

                if(v_data) {
                    let v = v_data.get(vz, vy, vz);      
                    if(isNaN(v)) {
                        color.setXYZ(i, 50, 50, 50); 
                        continue;
                    }
                    let h = map_value(v, v_stats.min, v_stats.max, 0, 180);
                    let s = 1;
                    let l = r2;

                    //convert hsl to rgb
                    let c = (1 - Math.abs(2 * l - 1)) * s;
                    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
                    let m = l - c/2;
                    let r = 0;
                    let g = 0;
                    let b = 0;
                    if (0 <= h && h < 60) {
                        r = c; g = x; b = 0;
                    } else if (60 <= h && h < 120) {
                        r = x; g = c; b = 0;
                    } else if (120 <= h && h < 180) {
                        r = 0; g = c; b = x;
                    } else if (180 <= h && h < 240) {
                        r = 0; g = x; b = c;
                    } else if (240 <= h && h < 300) {
                        r = x; g = 0; b = c;
                    } else if (300 <= h && h < 360) {
                        r = c; g = 0; b = x;
                    }
                    r = Math.round((r + m) * 255);
                    g = Math.round((g + m) * 255);
                    b = Math.round((b + m) * 255);
                    color.setXYZ(i, r, g, b);
                } else {
                    //r2 only
                    color.setXYZ(i, r2*255, 0, 0);
                }
            }
        },

        animate() {
            this.t.controls.update();
            this.t.camera_light.position.copy(this.t.camera.position);

            this.render();
            requestAnimationFrame(this.animate);
        },

        render() {
            this.t.renderer.clear();
            //this.t.renderer.render(this.back_scene, this.camera);
            //this.t.renderer.clearDepth();
            this.t.renderer.render(this.t.scene, this.t.camera);
        },

        compute_stats(data) {
            let min = null;
            let max = null;

            data.forEach(v=>{
                if (!isNaN(v)) {
                    if (min == null) min = v;
                    else min = v < min ? v : min;
                    if (max == null) max = v;
                    else max = v > max ? v : max;
                }
            });
            return {min, max};
        },

        load() {
            let vtkloader = new THREE.VTKLoader();

            let lh_pial = new Promise((resolve, reject)=>{
                vtkloader.load("testdata/lh.pial.vtk", resolve);
            });
            let lh_white = new Promise((resolve, reject)=>{
                vtkloader.load("testdata/lh.white.vtk", resolve);
            });
            let lh_inflated = new Promise((resolve, reject)=>{
                vtkloader.load("testdata/lh.inflated.vtk", resolve);
            });

            console.log("loading..");
            let all = Promise.all([lh_pial, lh_white, lh_inflated]).then(geometries=>{
                console.log("done loading lh");
                geometries.map(geometry=>geometry.computeVertexNormals());
                //geometries.map(geometry=>geometry.computeMorphNormals());

                let material = new THREE.MeshLambertMaterial({
                    //color: new THREE.Color(0.5,0.8,1.0),
                    vertexColors: THREE.VertexColors,
                    //shininess: 80,
                    morphTargets: true,
                    morphNormals: true, //doesn't work?
                });

                //first create a normal mesh
                var mesh = new THREE.Mesh( geometries[0], material );
                mesh.rotation.x = -Math.PI/2;
                this.mesh.lh = mesh;
                this.t.scene.add(mesh);
        
                //init colors for each vertices
                let position = mesh.geometry.attributes.position;
                let colors = new Uint8Array(position.count*3);
                colors.fill(0, 0, position.count);
                mesh.geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true).setDynamic(true));
                this.update_color();

                //set as morph target
                let mattr = mesh.geometry.morphAttributes;
                mattr.position = [
                    geometries[1].attributes.position.clone(), //lh_white
                    geometries[2].attributes.position.clone(), //lh_inflated
                ];
                mattr.normal = [
                    geometries[1].attributes.normal.clone(), //lh_white
                    geometries[2].attributes.normal.clone(), //lh_inflated
                ];
                mesh.updateMorphTargets();

                console.dir(mesh.geometry);
            });
            
            /* I am not sure what I can use this for..
            vtkloader.load("testdata/ctx-lh-lateraloccipital.vtk", geometry => {
                geometry.computeVertexNormals(); //for smooth shading
                let material = new THREE.MeshLambertMaterial({
                    color: new THREE.Color(0.2,0.5,1),
                    //shininess: 80,
                });
                var mesh = new THREE.Mesh( geometry, material );
                mesh.rotation.x = -Math.PI/2;
                this.t.scene.add(mesh);

                //randomize positions
                let position = mesh.geometry.attributes.position.clone();
                for ( var j = 0, jl = position.count; j < jl; j ++ ) {
                  position.setXYZ(j,
                    position.getX( j ) * 2 * Math.random(),
                    position.getY( j ) * 2 * Math.random(),
                    position.getZ( j ) * 2 * Math.random()
                  );
                }

                //set as morph target
                let mattr = mesh.geometry.morphAttributes;
                mattr.position = [position];
                mesh.updateMorphTargets();
                mesh.morphTargetInfluences[0] = 0.05;
            });
            */

            let r2 = new Promise((resolve, reject)=>{
                console.log("loading r2");
                fetch("testdata/prf/r2.nii.gz").then(res=>{
                    return res.arrayBuffer()
                }).then(buf=>{
                    let N = nifti.parse(pako.inflate(buf));
                    this.prf.header = N;
                    this.prf.r2 = ndarray(N.data, N.sizes.slice().reverse());
                    this.prf.r2_stats = this.compute_stats(N.data);
                    resolve();
                });
            });

            let p_angle = new Promise((resolve, reject)=>{
                console.log("loading polarangle");
                fetch("testdata/prf/polarAngle.nii.gz").then(res=>{
                    return res.arrayBuffer()
                }).then(buf=>{
                    let N = nifti.parse(pako.inflate(buf));
                    this.prf.p_angle = ndarray(N.data, N.sizes.slice().reverse());
                    this.prf.p_angle_stats = this.compute_stats(N.data);
                    resolve();
                });
            });

            let rf_width = new Promise((resolve, reject)=>{
                console.log("loading rfwidth");
                fetch("testdata/prf/rfWidth.nii.gz").then(res=>{
                    return res.arrayBuffer()
                }).then(buf=>{
                    let N = nifti.parse(pako.inflate(buf));
                    this.prf.rf_width = ndarray(N.data, N.sizes.slice().reverse());
                    this.prf.rf_width_stats = this.compute_stats(N.data);
                    resolve();
                });
            });

            let ecc = new Promise((resolve, reject)=>{
                console.log("loading eccentricity");
                fetch("testdata/prf/eccentricity.nii.gz").then(res=>{
                    return res.arrayBuffer()
                }).then(buf=>{
                    let N = nifti.parse(pako.inflate(buf));
                    this.prf.ecc = ndarray(N.data, N.sizes.slice().reverse());
                    this.prf.ecc_stats = this.compute_stats(N.data);
                    resolve();
                });
            });

            Promise.all([ r2, p_angle, rf_width, ecc ]).then(()=>{
                this.update_color();
            });
        },
    },
});

