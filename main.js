function map_value(v, in_min, in_max, out_min, out_max) {
    return (v - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function hsl_to_rgb(h, s, l) {
    //convert hsl to rgb
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x1 = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c/2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (0 <= h && h < 60) {
        r = c; g = x1; b = 0;
    } else if (60 <= h && h < 120) {
        r = x1; g = c; b = 0;
    } else if (120 <= h && h < 180) {
        r = 0; g = c; b = x1;
    } else if (180 <= h && h < 240) {
        r = 0; g = x1; b = c;
    } else if (240 <= h && h < 300) {
        r = x1; g = 0; b = c;
    } else if (300 <= h && h < 360) {
        r = c; g = 0; b = x1;
    }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    //color.setXYZ(i, r, g, b);
    return {r,g,b};
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

                overlay: 'r2*polar_angle',
                overlay_type: 'volume',
                //overlay: 'r2',
                r2_offset: 0,                  

                threshold_r2: false,
                threshold_level: 0.15,

                cortical_depth: 0.5,
                inflate: 0.5,

                //split: 0, //50
                //open: Math.PI/4,
		split: 20,
		open: Math.PI/8,
            },

            legend: {
                min: 0,
                max: 1,
                colors: [],
            },


           prf: {
               vol: {
                   r2: null,
                   p_angle: null,
                   rf_width: null,
                   ecc: null,
                   varea: null,  //optional
               },
               surf: {
                   lh: {
                       r2: null,
                       p_angle: null,
                       rf_width: null,
                       ecc: null,
                       varea: null,  //optional
                   },
                   rh: {
                       r2: null,
                       p_angle: null,
                       rf_width: null,
                       ecc: null,
                       varea: null, //optional
                   },
               },
           },


            loading: false,
            config: window.config || window.parent.config,
        }
    },
    template: `
    <div>
        <p class="loading" v-if="loading">Loading... <span style="opacity: 0.5; font-size: 80%">{{loading}}</span></p>
        <div id="three" ref="three"/>
        <div class="logo">brainlife.io</div>
        <div class="controls-help">
            <span>Rotate</span>
            <span>Zoom</span>
            <span>Pan</span>
            <br>
            <img src="controls.png" height="50px"/>
        </div>
        <div class="color-legend" v-if="legend.colors.length > 0">
            <div class="color" v-for="color in legend.colors" :style="{'background-color': 'rgb('+color.r+','+color.g+', '+color.b+')'}"/>
            <br>
            <span class="min">{{legend.min.toFixed(2)}}</span>
            <span class="max">{{legend.max.toFixed(2)}}</span>
        </div>
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
            //stop rotation when user interacts
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
            overlay.add(this.gui, 'overlay', [ 
                'r2', 
                'r2*polar_angle', 
                'r2*rf_width', 
                'r2*eccentricity', 
                'r2*varea',  //optional
            ]).onChange(v=>{
                this.update_color();
            });

            overlay.add(this.gui, 'overlay_type', [
                'volume',
                'surface',
            ]).onChange(v=>{
                this.update_color();
            });

            overlay.add(this.gui, 'r2_offset', 0, 1).step(0.01).onChange(v=>{
                this.update_color();
            });
                        /*
            overlay.add(this.gui, 'r2_min', 0, 0.5).step(0.01).onChange(v=>{
                this.update_color();
            });
            overlay.add(this.gui, 'r2_max', 0, 12).step(0.01).onChange(v=>{
                this.update_color();
            });
            */
            overlay.open();

            var threshold = this.gui.ui.addFolder('Threshold');
            // blacks out vertices for which variance explained is below a certain amount
   
            var p = threshold.add(this.gui, 'threshold_r2', true, false).onChange(v=>{
                if(!this.mesh.lh) return;
                this.update_color();
            });

            threshold.add(this.gui, 'threshold_level', 0, 1).step(0.01).onChange(v=>{
                if(!this.mesh.lh) return;
                this.gui.threshold_r2 = true;
                p.updateDisplay();
                // p.__prev = p.__checkbox.checked;
                this.update_color();
            });
            threshold.open();
        },

        resized() {
            var viewbox = this.$refs.three.getBoundingClientRect();
            this.t.camera.aspect = viewbox.width / viewbox.height;
            this.t.camera.updateProjectionMatrix();
            this.t.renderer.setSize(viewbox.width, viewbox.height);
        },

        /*
        mousemove(event) {
        },
        mouseup(event) {
        },
        mousedown(event) {
        },
        */

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
            if(!this.prf.vol.r2 && (!this.prf.surf.rh.r2 || !this.prf.surf.lh.r2)) return;

            let lh_geometry = this.mesh.lh.geometry;
            let lh_color = lh_geometry.attributes.color;
            let lh_position = lh_geometry.attributes.position;

            let rh_geometry = this.mesh.rh.geometry;
            let rh_color = rh_geometry.attributes.color;
            let rh_position = rh_geometry.attributes.position;

            let lh_white_geometry = this.mesh.lh.white_geometry;
            let rh_white_geometry = this.mesh.rh.white_geometry;
            let lh_white_position = lh_white_geometry.attributes.position;
            let rh_white_position = rh_white_geometry.attributes.position;

            //console.log("update_color");
            let r2 = this.prf.vol.r2;
            let v, vmin, vmax;

            let r2_lh, r2_rh;
            let v_lh, v_rh;

            switch(this.gui.overlay_type) {
            case "volume":
                switch(this.gui.overlay) {
                case "r2":
                    r2 = this.prf.vol.r2;
                    break;
                case "r2*polar_angle":
                    r2 = this.prf.vol.r2;
                    v = this.prf.vol.p_angle;
                    break;
                case "r2*rf_width":
                    r2 = this.prf.vol.r2;
                    v = this.prf.vol.rf_width;
                    break;
                case "r2*eccentricity":
                    r2 = this.prf.vol.r2;
                    v = this.prf.vol.ecc;
                    break;
                case "r2*varea":
                    r2 = this.prf.vol.r2;
                    v = this.prf.vol.varea;
                    if(!v) {
                        alert("No data for this overlay");
                        return;
                    }
                    break;
                }
                if(v) {
                    vmin = v.stats.min;
                    // debugger;
                    // Make vmax 90th percentile of values in case of eccentricity or rfWidth overlay
                    switch(this.gui.overlay) {
                        case "r2*eccentricity":
                        case "r2*rf_width":
                            vmax = v.perc();
                            //vmax = v.stats.max;
                            break;
                        default:
                            vmax = v.stats.max;
                            break;
                    }


                } else {
                    if(r2) {
                        vmin = r2.stats.min;
                        vmax = r2.stats.max;
                    }
                }

                set_color_vol.call(this, rh_color, rh_position, rh_white_position);
                set_color_vol.call(this, lh_color, lh_position, lh_white_position);

                break;
            case "surface":
                r2_lh = this.prf.surf.lh.r2;
                r2_rh = this.prf.surf.rh.r2;
                if(!r2_lh || !r2_rh) {
                    alert("No data for this overlay");
                    return;
                }
                switch(this.gui.overlay) {
                case "r2":
                    break;
                case "r2*polar_angle":
                    v_lh = this.prf.surf.lh.p_angle;
                    v_rh = this.prf.surf.rh.p_angle;
                    if(!v_lh || !v_rh) {
                        alert("No data for this overlay");
                        return;
                    }
                    break;
                case "r2*rf_width":
                    v_lh = this.prf.surf.lh.rf_width;
                    v_rh = this.prf.surf.rh.rf_width;
                    if(!v_lh || !v_rh) {
                        alert("No data for this overlay");
                        return;
                    }
                    break;
                case "r2*eccentricity":
                    v_lh = this.prf.surf.lh.ecc;
                    v_rh = this.prf.surf.rh.ecc;
                    if(!v_lh || !v_rh) {
                        alert("No data for this overlay");
                        return;
                    }
                    break;
                case "r2*varea":
                    v_lh = this.prf.surf.lh.varea;
                    v_rh = this.prf.surf.rh.varea;
                    if(!v_lh || !v_rh) {
                        alert("No data for this overlay");
                        return;
                    }
                    break;
                }
                if(v_lh) {
                    vmin = Math.min(v_lh.stats.min, v_rh.stats.min);
                    // Make vmax 90th percentile of values in case of eccentricity or rfWidth overlay
                    switch(this.gui.overlay) {
                        case "r2*eccentricity":
                        case "r2*rf_width":
                            vmax = Math.max(v_lh.perc(),v_rh.perc());
                            //vmax = Math.max(v_lh.stats.max, v_rh.stats.max);
                            break;
                        default:
                            vmax = Math.max(v_lh.stats.max, v_rh.stats.max);
                            break;
                    }
                } else {
                    vmin = Math.min(r2_lh.stats.min, r2_rh.stats.min);
                    vmax = Math.max(r2_lh.stats.max, r2_rh.stats.max);
                }

                set_color_surf.call(this, lh_color, r2_lh, v_lh);
                set_color_surf.call(this, rh_color, r2_rh, v_rh);

                break;
            }

//
//
            function set_color_vol(color, position, white_position) {

                this.legend.colors = [];
                for(let i = 0;i < 256;++i) {
                    let h,s,l;
                    if(this.gui.overlay == "r2") {
                        //r2 is shown as just gray
                        h = 0;
                        s = 0;
                        l = map_value(i, 0, 256, 0, 1);
                    } else {
                        h = map_value(i, 0, 256, 0, 240); //red to blue
                        s = 1;
                        l = 0.5;
                    }
                    this.legend.colors.push(hsl_to_rgb(h, s, l));
                }

                this.legend.min = vmin;
                this.legend.max = vmax;


                color.needsUpdate = true;

                for(var i = 0;i < color.count;++i) { 
                    if(!r2) {
                        //must be none - show white-ish brain
                        color.setXYZ(i, 200, 200, 200);
                        continue;
                    }
                    //get vertex coord
                    let x_b = position.getX(i);
                    let y_b = position.getY(i);
                    let z_b = position.getZ(i);

                    let x_w = white_position.getX(i);
                    let y_w = white_position.getY(i);
                    let z_w = white_position.getZ(i);

                    let x = (x_w - x_b) * this.gui.cortical_depth + x_b
                    let y = (y_w - y_b) * this.gui.cortical_depth + y_b
                    let z = (z_w - z_b) * this.gui.cortical_depth + z_b

                    //convert it to voxel coords and get the value
                    let header = this.prf.vol.r2.header;
                    //var affine = matrix_invert(header.affine);
                    var inv_affine = Sylvester.Matrix.create(header.affine); // vol -> surface affine -- Sylvester var from matrix-inverse.js (module?)
                    var affine = inv_affine.inverse().elements // surface coords -> volume coords affine
                    let vx = Math.round(x*affine[0][0] + y*affine[0][1] + z*affine[0][2] + affine[0][3]);
                    let vy = Math.round(x*affine[1][0] + y*affine[1][1] + z*affine[1][2] + affine[1][3]);
                    let vz = Math.round(x*affine[2][0] + y*affine[2][1] + z*affine[2][2] + affine[2][3]);

                    //let r2_val = r2.get(vx, vy, vz) + this.gui.r2_offset;
                    let r2_val = r2.get_avg(white_position, position, affine, i);

                    /*
                    if(isNaN(r2_val)) {
                        color.setXYZ(i, 50, 50, 50);
                        continue;
                    }
                    */

                    let h, s, l;
                    if(this.gui.threshold_r2) {
                        if(r2_val >= this.gui.threshold_level) {
                            l = 0.5;
                        } else {
                            l = 0.0;
                        }
                    } else {
                        l = map_value(r2_val, r2.stats.min, r2.stats.max, 0, 0.5);
                    }
                    if(v) {
                        // let v_val = v.get(vx, vy, vz);
                        let v_val = v.get_avg(white_position, position, affine, i); 
//			if (this.gui.overlay == "r2*varea") {
//				v_val = v.get(vx, vy, vz);
//			}
                        if(isNaN(v_val) || (v_val == 0 && this.gui.overlay != 'r2*polar_angle')) {
                            color.setXYZ(i, 50, 50, 100); 
                            continue;
                        }
                        h = map_value(v_val, vmin, vmax, 0, 240); //red to blue
                        s = 1;
                        //if(i % 10000 == 0) console.log(v_val, r2_val, vx, vy, vz, h);
                    } else {
                        //r2 only
                        h = 0;
                        s = 0; //gray!
                    }
                    
                    let {r,g,b} = hsl_to_rgb(h, s, l);
                    color.setXYZ(i, r, g, b);
                }


                
            }

            function set_color_surf(color, r2, v) {
                this.legend.colors = [];
                for(let i = 0;i < 256;++i) {
                    let h,s,l;
                    if(this.gui.overlay == "r2") {
                        //r2 is shown as just gray
                        h = 0;
                        s = 0;
                        l = map_value(i, 0, 256, 0, 1);
                    } else {
                        h = map_value(i, 0, 256, 0, 240); //red to blue
                        s = 1;
                        l = 0.5;
                    }
                    this.legend.colors.push(hsl_to_rgb(h, s, l));
                }

                this.legend.min = vmin;
                this.legend.max = vmax;

                color.needsUpdate = true;

                for(var i = 0;i < color.count;++i) { 
                    if(!r2) {
                        //must be none - show white-ish brain
                        color.setXYZ(i, 200, 200, 200);
                        continue;
                    }

                    let r2_val = r2.get(i) + this.gui.r2_offset;

                    let h, s, l;
                    if(this.gui.threshold_r2) {
                        // if(r2_val >= this.gui.threshold_level) {
                        if(r2_val - this.gui.r2_offset >= this.gui.threshold_level) {
                            l = 0.5;
                        } else {
                            l = 0.0;
                        }
                    } else {
                        l = map_value(r2_val, r2.stats.min, r2.stats.max, 0, 0.5);
                    }
                    if(v) {
                        let v_val = v.get(i);      
                        if(isNaN(v_val) || (v_val == 0 && this.gui.overlay != 'r2*polar_angle')) {
                            color.setXYZ(i, 50, 50, 100); 
                            continue;
                        }
                        h = map_value(v_val, vmin, vmax, 0, 240); //red to blue
                        s = 1;
                        //if(i % 10000 == 0) console.log(v_val, r2_val, vx, vy, vz, h);
                    } else {
                        //r2 only
                        h = 0;
                        s = 0; //gray!
                    }
                    
                    let {r,g,b} = hsl_to_rgb(h, s, l);
                    color.setXYZ(i, r, g, b);
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


        create_mesh(material, base_geometry, white_geometry, inflated_geometry) {
            //first create a normal mesh
            var mesh = new THREE.Mesh( base_geometry, material );
//
            var white_mesh = new THREE.Mesh( white_geometry, material );
            mesh.white_geometry = white_mesh.geometry;
//
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
                "lh.pial.vtk",
                "lh.white.vtk",
                "lh.inflated.vtk",
                "rh.pial.vtk",
                "rh.white.vtk",
                "rh.inflated.vtk",
            ];
            let promises = vtks.map(vtk=>{
                this.loading = "surfaces";
                return new Promise((resolve, reject)=>{
		    let url = this.config.urlbase+"/surfaces/"+vtk;
		    if(this.config.jwt) url += "?at="+this.config.jwt;
                    vtkloader.load(url, resolve, p=>{
                        this.loading = vtk+" "+(p.loaded/p.total*100).toFixed(1)+"%";
                    });
                });
            });

            console.log("loadin all vtks");
            Promise.all(promises).then(geometries=>{
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
                this.update_position();

                this.loading = "pRF volumes";

		let promises = [];
	    	let nifties = ["r2.nii.gz", "polarAngle.nii.gz", "rfWidth.nii.gz", "eccentricity.nii.gz", "varea.nii.gz"];
		nifties.forEach(n=>{
		    let url = this.config.urlbase+"/"+n;
		    if(this.config.jwt) url += "?at="+this.config.jwt;
            promises.push(load_nifti.call(this, url));
        });

            let gifties = ["lh.r2.gii", "lh.polarAngle.gii", "lh.rfWidth.gii", "lh.eccentricity.gii", "lh.varea.gii", "rh.r2.gii", "rh.polarAngle.gii", "rh.rfWidth.gii", "rh.eccentricity.gii", "rh.varea.gii"];
        gifties.forEach(n=>{
            let url = this.config.urlbase+"/prf_surfaces/"+n;
            if(this.config.jwt) url += "?at="+this.config.jwt;
            promises.push(load_gifti.call(this,url));
		});
                Promise.all(promises).then(outs=>{
                    console.log("loaded all volumes");
                    //console.dir(outs);

                    this.prf.vol.r2 = outs[0];
                    this.prf.vol.p_angle = outs[1];
                    this.prf.vol.rf_width = outs[2];
                    this.prf.vol.ecc = outs[3];
                    this.prf.vol.varea = outs[4];
                    this.prf.surf.lh.r2 = outs[5];
                    this.prf.surf.lh.p_angle = outs[6];
                    this.prf.surf.lh.rf_width = outs[7];
                    this.prf.surf.lh.ecc = outs[8];
                    this.prf.surf.lh.varea = outs[9];
                    this.prf.surf.rh.r2 = outs[10];
                    this.prf.surf.rh.p_angle = outs[11];
                    this.prf.surf.rh.rf_width = outs[12];
                    this.prf.surf.rh.ecc = outs[13];
                    this.prf.surf.rh.varea = outs[14];
                    this.update_color();
                    this.loading = false;
                });
            });

            //debugger;

            function load_gifti(path) {
                return new Promise((resolve, reject)=>{
                    this.loading = path;
                    fetch(path).then(res=>{
                        return res.text()
                    }).then(xml=>{
                        var gii = gifti.parse(xml);
                        let data = gii.dataArrays[0].getData();
                        let get = function(i) {
                            return data[i];
                        }
                        let min = null;
                        let max = null;
                        let len = function() {
                            return data.length;
                        }
                        let perc = function() {
                            var arr = [];
                            var i;
                            for (i=0; i<data.length; i++) {
                                if (!isNaN(data[i]) && data[i] != 0.0) {
                                    arr.push(data[i]);
                                }
                            }
                            var index = Math.floor(arr.length*0.99);
                            return arr.sort()[index];
                        }
                        data.forEach(v=>{
                            if (!isNaN(v)) {
                                if (min == null) min = v;
                                else min = v < min ? v : min;
                                if (max == null) max = v;
                                else max = v > max ? v : max;
                            }
                        });
                        resolve({stats: {min, max}, get, len, perc});
                    }).catch(err=>{
                        console.log("failed to load gifti:"+path);
                        console.dir(err);
                        resolve(null); 
                    });
                });
            }
            
            function load_nifti(path) {
                return new Promise((resolve, reject)=>{
                    this.loading = path;
                    fetch(path).then(res=>{
                        return res.arrayBuffer()
                    }).then(buf=>{
                        buf = nifti.decompress(buf);
                        let header = nifti.readHeader(buf);
                        let image = nifti.readImage(header, buf);

                        /*
                        https://nifti.nimh.nih.gov/pub/dist/src/niftilib/nifti1.h
                        #define DT_UINT8                   2
                        #define DT_INT16                   4
                        #define DT_INT32                   8
                        #define DT_FLOAT32                16
                        #define DT_COMPLEX64              32
                        #define DT_FLOAT64                64
                        #define DT_RGB24                 128
                        */
                       //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects#Indexed_collections
                        switch(header.datatypeCode) {
                        case 8: //DT_INT32
                            image = new Int32Array(image);
                            break;
                        case 16: //DT_FLOAT32
                            image = new Float32Array(image);
                            break;
                        case 64: //DT_FLOAT64
                            image = new Float64Array(image);
                            break;
                        }
                        let x_step = 1;
                        let y_step = header.dims[1];
                        let z_step = header.dims[1]*header.dims[2];

                        let get = function(x, y, z) {
                            let idx = x_step*x+y_step*y+z_step*z;
                            return image[idx];
                        }

                        let get_avg = function(white, pial, affine, i) {
                            var voxs = [];
                            var sum = 0;
                            var numsteps = 10;
                            for (var j = 0; j <= numsteps; j++) {
                                let x = (white.getX(i) - pial.getX(i))*(j/numsteps) + pial.getX(i);
                                let y = (white.getY(i) - pial.getY(i))*(j/numsteps) + pial.getY(i);
                                let z = (white.getZ(i) - pial.getZ(i))*(j/numsteps) + pial.getZ(i);
                                let vx = Math.round(x*affine[0][0] + y*affine[0][1] + z*affine[0][2] + affine[0][3]);
                                let vy = Math.round(x*affine[1][0] + y*affine[1][1] + z*affine[1][2] + affine[1][3]);
                                let vz = Math.round(x*affine[2][0] + y*affine[2][1] + z*affine[2][2] + affine[2][3]);
                                // if (!voxs.includes(vx,vy,vz)) {
                                //     voxs.push([vx,vy,vz]);
                                // }
                                voxs.push([vx,vy,vz]);
                            }
                            var n = 0;
                            for (var j = 0; j < voxs.length; j++) {
                                let idx = x_step*voxs[j][0]+y_step*voxs[j][1]+z_step*voxs[j][2];
                                if (!isNaN(image[idx])) {
                                    sum = sum + image[idx];
                                    n = n+1;
                                    // console.log(image[idx]);
                                }
                            }
                            return sum/n;
                        }

                        let min = null;
                        let max = null;
                        let len = function() {
                            return image.length;
                        }
                        let perc = function() {
                            var arr = [];
                            var i;
                            for (i=0; i<image.length; i++) {
                                if (!isNaN(image[i]) && image[i] != 0.0) {
                                    arr.push(image[i]);
                                }
                            }
                            var index = Math.floor(arr.length*0.80);
                            return arr.sort()[index];
                        }
                        image.forEach(v=>{
                            if (!isNaN(v)) {
                                if (min == null) min = v;
                                else min = v < min ? v : min;
                                if (max == null) max = v;
                                else max = v > max ? v : max;
                            }
                        });
                        resolve({header, image, stats: {min, max}, get, get_avg, len, perc});
                    }).catch(err=>{
                        console.log("failed to load nifti:"+path);
                        console.dir(err);
                        resolve(null); 
                    });
                });
            }

        },
    },
});
