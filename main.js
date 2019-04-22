
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
                show_stats: false,
                weight_field: 'count',
                cortical_depth: 0,
                inflate: 0,
            },

            prf: {
                r2: null, 
                r2_data: null,
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
            ui.add(this.gui, 'show_stats');
            ui.open();

            var matrix = this.gui.ui.addFolder('Matrix');
            matrix.add(this.gui, 'weight_field',  [ 'count', 'density' ]);
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
            if(!this.prf.r2) return;

            let geometry = this.mesh.lh.geometry;
            let color = geometry.attributes.color;
            let position = geometry.attributes.position;
            for(var i = 0;i < color.count;++i) { 
                //get vertex coord
                let x = position.getX(i);
                let y = position.getY(i);
                let z = position.getZ(i);
                
                //convert it to voxel coords and get the value
                let vx = Math.round((x - this.prf.r2.spaceOrigin[0]) / this.prf.r2.thicknesses[0]);
                let vy = Math.round((y - this.prf.r2.spaceOrigin[1]) / this.prf.r2.thicknesses[1]);
                let vz = Math.round((z - this.prf.r2.spaceOrigin[2]) / this.prf.r2.thicknesses[2]);
                let v = this.prf.r2_data.get(vz, vy, vz);
                //if(i%1000 == 0) console.dir(v);
                
                if(isNaN(v)) {
                    color.setXYZ(i, 50, 50, 50); 
                } else {
                    color.setXYZ(i, v*200, 0, 0); 
                }
            }
            color.needsUpdate = true;
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

                let material = new THREE.MeshLambertMaterial({
                    //color: new THREE.Color(0.5,0.8,1.0),
                    vertexColors: THREE.VertexColors,
                    //shininess: 80,
                    morphTargets: true,
                    //morphNormals: true, //doesn't work?
                });

                //first create a normal mesh
                var mesh = new THREE.Mesh( geometries[0], material );
                mesh.rotation.x = -Math.PI/2;
                this.mesh.lh = mesh;
                this.t.scene.add(mesh);
                //console.dir(this.mesh.lh.geometry.attributes);
        
                //init colors for each vertices
                let position = mesh.geometry.attributes.position;
                let colors = new Uint8Array(position.count*3);
                colors.fill(0, 0, position.count);
                mesh.geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3, true).setDynamic(true));
                this.update_color();

                /*
                //randomize positions
                let position = mesh.geometry.attributes.position.clone();
                for ( var j = 0, jl = position.count; j < jl; j ++ ) {
                  position.setXYZ(j,
                    position.getX( j ) * 2 * Math.random(),
                    position.getY( j ) * 2 * Math.random(),
                    position.getZ( j ) * 2 * Math.random()
                  );
                }
                */

                //set as morph target
                let mattr = mesh.geometry.morphAttributes;
                mattr.position = [
                    geometries[1].attributes.position.clone(), //lh_white
                    geometries[2].attributes.position.clone(), //lh_inflated
                ];
                mesh.updateMorphTargets();
                //mesh.morphTargetInfluences[0] = 0;
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

            fetch("testdata/prf/r2.nii.gz").then(res=>{
                return res.arrayBuffer()
            }).then(buf=>{
                this.prf.r2 = nifti.parse(pako.inflate(buf));
                this.prf.r2_data = ndarray(this.prf.r2.data, this.prf.r2.sizes.slice().reverse());
                this.update_color();
            });
        },
    },
});

