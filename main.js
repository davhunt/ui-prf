
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

                split: 50,
                open: Math.PI/4,
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
        //this.t.camera_light.radius = 1;
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

            ui.add(this.gui, 'cortical_depth', 0, 1).step(0.01).onChange(v=>{
                if(!this.mesh.lh) return;
                this.mesh.lh.morphTargetInfluences[0] = v;
                this.mesh.rh.morphTargetInfluences[0] = v;
                this.update_color();
            });
            ui.add(this.gui, 'inflate', 0, 1).step(0.01).onChange(v=>{
                if(!this.mesh.lh) return;
                this.mesh.lh.morphTargetInfluences[1] = v;
                this.mesh.rh.morphTargetInfluences[1] = v;
            });
            ui.add(this.gui, 'split', 0, 150).onChange(v=>{
                if(!this.mesh.lh) return;
                this.update_position();
            });
            ui.add(this.gui, 'open', 0, Math.PI).onChange(v=>{
                if(!this.mesh.lh) return;
                this.update_position();
            });

            ui.open();
            
            var overlay = this.gui.ui.addFolder('Overlay');
            overlay.add(this.gui, 'overlay', [ 'none', 'r2', 'r2*polar_angle', 'r2*rf_width', 'r2*eccentricity' ]).onChange(v=>{
                //console.log(v);
                this.update_color();
            });
            overlay.add(this.gui, 'r2_min', 0, 0.5).step(0.01).onChange(v=>{
                this.update_color();
            });
            overlay.add(this.gui, 'r2_max', 0, 2).step(0.01).onChange(v=>{
                this.update_color();
            });
            overlay.open();
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

        update_position() {
            this.mesh.lh.position.x = -this.gui.split;
            this.mesh.rh.position.x = this.gui.split;
            this.mesh.lh.rotation.z = -this.gui.open;
            this.mesh.rh.rotation.z = this.gui.open;
        },

        update_color() {
            //make sure we have everything we need
            if(!this.mesh.lh) return;
            if(!this.mesh.rh) return;
            if(!this.prf.header) return;

            //console.log("update_color");
            let v_data;
            let v_stats;
            let r2_data;
            switch(this.gui.overlay) {
            case "r2":
                r2_data = this.prf.r2;
                break;
            case "r2*polar_angle":
                r2_data = this.prf.r2;
                v_data = this.prf.p_angle;
                v_stats = this.prf.p_angle_stats;
                break;
            case "r2*rf_width":
                r2_data = this.prf.r2;
                v_data = this.prf.rf_width;
                v_stats = this.prf.rf_width_stats;
                break;
            case "r2*eccentricity":
                r2_data = this.prf.r2;
                v_data = this.prf.ecc;
                v_stats = this.prf.ecc_stats;
                break;
            }

            let lh_geometry = this.mesh.lh.geometry;
            let lh_color = lh_geometry.attributes.color;
            let lh_position = lh_geometry.attributes.position;

            let rh_geometry = this.mesh.rh.geometry;
            let rh_color = rh_geometry.attributes.color;
            let rh_position = rh_geometry.attributes.position;
 
            function set_color(color, position) {
                for(var i = 0;i < color.count;++i) { 
                    if(!r2_data) {
                        //must be none
                        color.setXYZ(i, 200, 200, 200); 
                        continue;
                    }
                    //get vertex coord
                    let x = position.getX(i);
                    let y = position.getY(i);
                    let z = position.getZ(i);
                    
                    //convert it to voxel coords and get the value
                    let vx = Math.round((x - this.prf.header.spaceOrigin[0]) / this.prf.header.thicknesses[0]);
                    let vy = Math.round((y - this.prf.header.spaceOrigin[1]) / this.prf.header.thicknesses[1]);
                    let vz = Math.round((z - this.prf.header.spaceOrigin[2]) / this.prf.header.thicknesses[2]);

                    let r2 = r2_data.get(vz, vy, vz);
                    if(isNaN(r2)) {
                        color.setXYZ(i, 50, 50, 50); 
                        continue;
                    }
                    //TODO - the way r2/min/max is applied is wrong
                    r2 = map_value(r2, this.prf.r2_stats.min - this.gui.r2_min, this.gui.r2_max/this.prf.r2_stats.max, 0, 1);

                    if(v_data) {
                        let v = v_data.get(vz, vy, vz);      
                        if(isNaN(v)) {
                            color.setXYZ(i, 50, 50, 50); 
                            continue;
                        }
                        let h = map_value(v, v_stats.min, v_stats.max, 0, 240);
                        //h = 240;
                        //if(i % 5000 == 0) console.log(v, h);
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
            }
            set_color.call(this, rh_color, rh_position);
            set_color.call(this, lh_color, lh_position);
            lh_color.needsUpdate = true;
            rh_color.needsUpdate = true;
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

        create_mesh(material, base_geometry, white_geometry, inflated_geometry) {
            //first create a normal mesh
            var mesh = new THREE.Mesh( base_geometry, material );
            mesh.rotation.x = -Math.PI/2;
            this.t.scene.add(mesh);
    
            //init colors for each vertices
            let position = mesh.geometry.attributes.position;
            let colors = new Uint8Array(position.count*3);
            colors.fill(0, 0, position.count);
            mesh.geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true).setDynamic(true));

            //set as morph target
            let mattr = mesh.geometry.morphAttributes;
            mattr.position = [
                white_geometry.attributes.position.clone(),
                inflated_geometry.attributes.position.clone(),
            ];
            mattr.normal = [
                white_geometry.attributes.normal.clone(),
                inflated_geometry.attributes.normal.clone(),
            ];
            mesh.updateMorphTargets();
            return mesh;
        },

        load() {
            let vtkloader = new THREE.VTKLoader();

            let vtks = [ 
                "testdata/lh.pial.vtk",
                "testdata/lh.white.vtk",
                "testdata/lh.inflated.vtk",

                "testdata/rh.pial.vtk",
                "testdata/rh.white.vtk",
                "testdata/rh.inflated.vtk",
            ];
            let promises = vtks.map(vtk=>{
                return new Promise((resolve, reject)=>{
                    vtkloader.load(vtk, resolve);
                });
            });

            console.log("loadin all vtks");
            let all = Promise.all(promises).then(geometries=>{
                geometries.map(geometry=>geometry.computeVertexNormals());

                let material = new THREE.MeshLambertMaterial({
                    vertexColors: THREE.VertexColors,
                    morphTargets: true,
                    morphNormals: true, 
                });
                this.mesh.lh = this.create_mesh(material, geometries[0], geometries[1], geometries[2]);
                this.t.scene.add(this.mesh.lh);

                this.mesh.rh = this.create_mesh(material, geometries[3], geometries[4], geometries[5]);
                this.t.scene.add(this.mesh.rh);
                
                console.log("loaded all vtks");
                this.update_color();
                this.update_position();
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
                    console.log("p_angle");
                    console.dir(this.prf.p_angle_stats);
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
                    //console.log("rfWidth");
                    //console.dir(this.prf.rf_width_stats);
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
                console.log("loaded all nifties");
                this.update_color();
            });
        },
    },
});

