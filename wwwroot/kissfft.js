self.importScripts("a.out.js");

const scalar_size = 4;

function make_dataset(k_xdim, k_ydim, k_zdim, pd, t1, t2, t2s, na_mm, na_t1, na_ex_frac, na_t2s, na_t2f) {
    pd_buff = allocFromArray(pd);
    pd_ptr = pd_buff.byteOffset;
    t1_buff = allocFromArray(t1);
    t1_ptr = t1_buff.byteOffset;
    t2_buff = allocFromArray(t2);
    t2_ptr = t2_buff.byteOffset;
    t2s_buff = allocFromArray(t2s);
    t2s_ptr = t2s_buff.byteOffset;
    if(na_mm != undefined) {
        na_mm_buff = allocFromArray(na_mm);
        na_mm_ptr = na_mm_buff.byteOffset;
        na_t1_buff = allocFromArray(na_t1);
        na_t1_ptr = na_t1_buff.byteOffset;
        na_ex_frac_buff = allocFromArray(na_ex_frac);
        na_ex_frac_ptr = na_ex_frac_buff.byteOffset;
        na_t2s_buff = allocFromArray(na_t2s);
        na_t2s_ptr = na_t2s_buff.byteOffset;
        na_t2f_buff = allocFromArray(na_t2f);
        na_t2f_ptr = na_t2f_buff.byteOffset;
    } else {
        na_mm_ptr = 0;
        na_t1_ptr = 0;
        na_ex_frac_ptr = 0;
        na_t2s_ptr = 0;
        na_t2f_ptr = 0;
    }
    dataset = _make_dataset(k_xdim,k_ydim,k_zdim,pd_ptr, t1_ptr, t2_ptr, t2s_ptr, na_mm_ptr, na_t1_ptr, na_ex_frac_ptr, na_t2s_ptr, na_t2f_ptr);
    return dataset;
}

function free_dataset(dataset) {
    _free_dataset(dataset);
}

function make_noise_params(params) {
    var mean = "img_noise_mean" in params ? parseFloat(params["img_noise_mean"]) : 0;
    var sigma = "img_noise_sigma" in params ? parseFloat(params["img_noise_sigma"]) : 0.001;

    var noise_types = {
        Gaussian: 1,
        Motion: 2,
    };
    var noise_type = 0;
    if("img_noise_type" in params && params["img_noise_type"] == 2) {
        noise_type += noise_types["Gaussian"];
    }
    noise_params = _make_noise_params(noise_type, mean, sigma);
    return noise_params;
}

function make_params(params) {
    sequence = 0
    var sequence_enum = {
        SE: 0,
        IR: 1,
        bSSFP: 2,
        FISP: 3,
        PSIF: 4,
        SGRE: 5,
        Na: 6,
        SQ: 7,
        TQ: 8,
        TQSQR: 9,
        TQF: 10,
        pcbSSFP: 11,
    };
    var sequence_params = ["te", "tr", "ti", "fa", "tau1", "tau2", "te_start", "te_end", "te_step"];
    var s_params = [];
    var n_params = 0;
    if("tq_params" in params) {
        for(p in sequence_params) {
            if(params["tq_params"][sequence_params[p]] != undefined) {
                s_params.push(params[sequence_params[p]]);
                n_params += 1;
            }
        }
        for(p in sequence_params) {
            if(params["sq_params"][sequence_params[p]] != undefined) {
                s_params.push(params[sequence_params[p]]);
                n_params += 1;
            }
        }
    } else {
        for(p in sequence_params) {
            if(params[sequence_params[p]] != undefined) {
                s_params.push(params[sequence_params[p]]);
                n_params += 1;
            }
        }
    }
    var s_params = scalar_size == 4 ? allocFromArray(Float32Array.from(s_params)) : allocFromArray(Float64Array.from(s_params));
    var fft3d = 'fft' in params ? params['fft'] == '3d' : true;
    var use_cs = "cs" in params ? params["cs"]>0 : false;
    var [cs_params, callback_ptr] = make_cs_params(params);
    var noise_params = make_noise_params(params);
    var filter_params = make_filter_params(params);
    c_params = _make_params(sequence_enum[params["sequence"]], n_params, s_params.byteOffset, params["xdim"], params["ydim"], params["zdim"], params["ixdim"], params["iydim"], params["izdim"], params["xstart"], params["ystart"], params["zstart"], params["nearest"], use_cs, fft3d, cs_params, noise_params, filter_params);
    return [c_params, callback_ptr];
}

function free_params(params) {
    _free_params(params);
}

function simulate_fast(ds, params) {
    var xdim = Math.round(params["xdim"]);
    xdim = xdim > 0 ? xdim : k_xdim;
    xdim = xdim > k_xdim ? k_xdim : xdim;
    var ixdim = params["ixdim"];
    var ydim = Math.round(params["ydim"]);
    ydim = ydim > 0 ? ydim : k_ydim;
    ydim = ydim > k_ydim ? k_ydim : ydim;
    var iydim = params["iydim"];
    var zdim = Math.round(params["zdim"]);
    zdim = zdim > 0 ? zdim : k_zdim;
    zdim = zdim > k_zdim ? k_zdim : zdim;
    var izdim = params["izdim"];

    var image_buff = alloc(ixdim*iydim*izdim*scalar_size*2);
    var image_ptr = image_buff.byteOffset;
    var kspace_buff = alloc(ixdim*iydim*izdim*scalar_size*2);
    var kspace_ptr = kspace_buff.byteOffset;
    var use_cs = "cs" in params ? params["cs"]>0 : false;
    var cs_buff = undefined;
    var cs_ptr = 0;
    var cs_kspace_buff = undefined;
    var cs_kspace_ptr = 0;
    var filt_buff = undefined;
    var filt_ptr = 0;
    var filt_kspace_buff = undefined;
    var filt_kspace_ptr = 0;
    if(use_cs) {
        cs_buff = alloc(ixdim*iydim*izdim*scalar_size*2);
        cs_ptr = cs_buff.byteOffset;
        cs_kspace_buff = alloc(ixdim*iydim*izdim*scalar_size*2);
        cs_kspace_ptr = cs_kspace_buff.byteOffset;
        filt_buff = alloc(ixdim*iydim*izdim*scalar_size*2);
        filt_ptr = filt_buff.byteOffset;
        filt_kspace_buff = alloc(ixdim*iydim*izdim*scalar_size*2);
        filt_kspace_ptr = filt_kspace_buff.byteOffset;
    }
    try {

        [p, callback_ptr] = make_params(params);
        _simulate(p, image_ptr, kspace_ptr, filt_ptr, filt_kspace_ptr, cs_ptr, cs_kspace_ptr, ds);
        
        var in_image = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, image_ptr, ixdim*iydim*izdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, image_ptr, ixdim*iydim*izdim*2));
        var image = scalar_size==4?new Float32Array(xdim*ydim*zdim):new Float64Array(xdim*ydim*zdim);
        for(var x=0;x<xdim;x++) {
            for(var y=0;y<ydim;y++) {
                for(var z=0;z<zdim;z++) {
                    image[z*xdim*ydim+y*xdim+x] = in_image[(z*ixdim*iydim+y*ixdim+x)*2];
                }
            }
        }
        var kspace = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, kspace_ptr, ixdim*iydim*izdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, kspace_ptr, ixdim*iydim*izdim*2));

        var filt_image = undefined;
        var filt_kspace = undefined;
        if(use_cs) {
            in_image = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, filt_ptr, ixdim*iydim*izdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, filt_ptr, ixdim*iydim*izdim*2));
            filt_image = scalar_size==4?new Float32Array(xdim*ydim*zdim):new Float64Array(xdim*ydim*zdim);
            for(var x=0;x<xdim;x++) {
                for(var y=0;y<ydim;y++) {
                    for(var z=0;z<zdim;z++) {
                        filt_image[z*xdim*ydim+y*xdim+x] = in_image[(z*ixdim*iydim+y*ixdim+x)*2];
                    }
                }
            }
            filt_kspace = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, filt_kspace_ptr, ixdim*iydim*izdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, filt_kspace_ptr, ixdim*iydim*izdim*2));
        }

        var cs_image = undefined;
        var cs_kspace = undefined;
        if(use_cs) {
            in_image = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, cs_ptr, ixdim*iydim*izdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, cs_ptr, ixdim*iydim*izdim*2));
            cs_image = scalar_size==4?new Float32Array(xdim*ydim*zdim):new Float64Array(xdim*ydim*zdim);
            for(var x=0;x<xdim;x++) {
                for(var y=0;y<ydim;y++) {
                    for(var z=0;z<zdim;z++) {
                        cs_image[z*xdim*ydim+y*xdim+x] = in_image[(z*ixdim*iydim+y*ixdim+x)*2];
                    }
                }
            }
            cs_kspace = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, cs_kspace_ptr, ixdim*iydim*izdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, cs_kspace_ptr, ixdim*iydim*izdim*2));
        }
    } catch (e) {
        console.log(e);
    } finally {

        Module.removeFunction(callback_ptr);
        free_params(p);
        Module._free(image_ptr);
        Module._free(kspace_ptr);
        Module._free(cs_ptr); 
        Module._free(cs_kspace_ptr);
        Module._free(filt_ptr);
        Module._free(filt_kspace_ptr);
    }

    return [image, kspace, filt_image, filt_kspace, cs_image, cs_kspace];
}

function make_cs_params(params) {
    var ninner = "cs_ninner" in params ? parseInt(params["cs_ninner"]) : 1;
    var nbreg = "cs_nbreg" in params ? parseInt(params["cs_nbreg"]) : 80;
    var lambda = "cs_lambda1" in params ? parseFloat(params["cs_lambda1"]):1.0;
    var lambda2 = "cs_lambda2" in params? parseFloat(params["cs_lambda2"]):0.15;
    var mu = "cs_mu" in params ? params["cs_mu"] : 1.0;
    var gam = "cs_gam" in params? parseFloat(params["cs_gam"]):1;
    var callback_ptr = 0;
    if ("cs_callback" in params) {
        callback_ptr = Module.addFunction(params["cs_callback"], "vi")
    }
    
    var cs_params = _make_cs_params(ninner, nbreg, lambda, lambda2, mu, gam, callback_ptr)
    return [cs_params, callback_ptr];
}

function make_filter_params(params) {
    var filter_mode = "kspace_filter_mode" in params? parseInt(params["kspace_filter_mode"]):0.0;
    var filter_fraction = "kspace_filter_fraction" in params? parseFloat(params["kspace_filter_fraction"])/100.0:0.5;
    var fmin = "kspace_filter_fmin" in params? parseFloat(params["kspace_filter_fmin"]):0.0;
    var fmax = "kspace_filter_fmax" in params? parseFloat(params["kspace_filter_fmax"]):100.0;

    var filter_params = _make_filter_params(filter_mode, filter_fraction, fmin, fmax);
    return filter_params
}

function compressed_sensing_fast(data, params) {
    
    var xdim = Math.round(params["xdim"]);
    xdim = xdim > 0 ? xdim : k_xdim;
    xdim = xdim > k_xdim ? k_xdim : xdim;
    var ydim = Math.round(params["ydim"]);
    ydim = ydim > 0 ? ydim : k_ydim;
    ydim = ydim > k_ydim ? k_ydim : ydim;
    var zdim = Math.round(params["zdim"]);
    zdim = zdim > 0 ? zdim : k_zdim;
    zdim = zdim > k_zdim ? k_zdim : zdim;
    
    var [cs_params, callback_ptr] = make_cs_params(params);
    var f_data = scalar_size == 4 ? allocFromArray(data) : allocFromArray(Float64Array.from(data));
    var f_data_ptr = f_data.byteOffset;
    var out = alloc(xdim*ydim*zdim*scalar_size*2);
    var out_ptr = out.byteOffset;

    _compressed_sensing(f_data_ptr, out_ptr, cs_params);

    var img = new Float32Array(xdim*ydim*zdim);
    if(scalar_size == 8) {
        var tmp = new Float64Array(img.length);
        tmp.set(new Float64Array(Module.HEAPU8.buffer, out_ptr, img.length*2));

        for(var i=0;i<img.length;i++) {
            img[i] = tmp[2*i];
        }
    } else {
        var tmp = new Float32Array(img.length*2);
        tmp.set(new Float32Array(Module.HEAPU8.buffer, out_ptr, img.length*2));

        for(var i=0;i<img.length;i++) {
            img[i] = tmp[2*i];
        }
    }

    var kspace = new Float32Array(xdim*ydim*zdim*2);
    if(scalar_size == 8) {
        var tmp = new Float64Array(kspace.length);
        tmp.set(new Float64Array(Module.HEAPU8.buffer, f_data_ptr, kspace.length));

        for(var i=0;i<img.length;i++) {
            kspace[i] = tmp[i];
        }
    } else {
        kspace.set(new Float32Array(Module.HEAPU8.buffer, f_data_ptr, kspace.length));
    }
    
    Module.removeFunction(callback_ptr);
    free(cs_params);
    free(f_data);
    free(out);

    return [img, kspace];
}

function calc_phantom(dims) {
    var sstrs = Array(DIMS);
    var samples = 0;
    var d3 = false;
    var kspace = false;
    var popts  = _pha_opts_defaults;

    for(var i=0;i<DIMS;i++) {sstrs[i] = 0;}
    
    var size = 2;
    for(var dim in dims) {
        size = size*dims[dim];
    }
    var data = alloc(size*scalar_size);

    _num_init();
    _calc_phantom(dims, data.byteOffset, d3, kspace, sstrs, samples, popts);
    //_calc_bart(dims, data.byteOffset, kspace, sstrs, samples, popts);
    _calc_circ(dims, data.byteOffset, d3, kspace, sstrs, samples, popts);

    var pdata = new Float32Array(size);
    pdata.set(new Float32Array(Module.HEAPU8.buffer, data.byteOffset, size));

    free(data);
    return pdata;
}

/** Compute the FFT of a real-valued mxn matrix. */
function fft(data, dims, flags=0) {
    /* Allocate input and output arrays on the heap. */
    
    var size = 2
    for(var dim in dims) {
        size = size*dims[dim];
    }
    var outData = alloc(size*scalar_size);
    var inData = alloc(size*scalar_size);
    for(var i=0;i<data.length;i++) {
        inData[2*i] = data[i];
    }

    _fft(dims.length, dims, flags, inData.byteOffset, outData.byteOffset);

    /* Get spectrum from the heap, copy it to local array. */
    var spectrum = new Float32Array(size);
    if(scalar_size==8) {
        var tmp = new Float64Array(Module.HEAPU8.buffer, heapSpectrum.byteOffset, size);
        for(var i=0;i<tmp.length;i++) { spectrum[i] = tmp[i]; }
    } else {
        spectrum.set(new Float32Array(Module.HEAPU8.buffer, heapSpectrum.byteOffset, size));
    }   

    /* Free heap objects. */
    free(heapData);
    free(heapSpectrum);

    return spectrum;
}

/** Compute the inverse FFT of a real-valued mxn matrix. */
function ifft(data, dims, flags=0) {
    var size = 2
    for(var dim in dims) {
        size = size*dims[dim];
    }
    var outData = alloc(size*scalar_size);
    var inData = alloc(size*scalar_size);
    for(var i=0;i<data.length;i++) {
        inData[2*i] = data[i];
    }

    _ifft(dims.length, dims, flags, inData.byetOffset, outData.byteOffset);

    var data = scalar_size==4 ? Float32Array.from(new Float32Array(Module.HEAPU8.buffer,heapData.byteOffset, size)): Float32Array.from(new Float64Array(Module.HEAPU8.buffer,heapData.byteOffset, size));

    //for (i=0;i<size;i++) {
        //data[i] /= size;
    //}

    free(heapSpectrum);
    free(heapData);

    return data;
}

/** Create a heap array from the array ar. */
function allocFromArray(ar) {
    /* Allocate */
    var nbytes = ar.length * ar.BYTES_PER_ELEMENT;
    var heapArray = alloc(nbytes);

    /* Copy */
    heapArray.set(new Uint8Array(ar.buffer));
    return heapArray;
}

/** Allocate a heap array to be passed to a compiled function. */
function alloc(nbytes) {
    var ptr = Module._malloc(nbytes)>>>0;
    return new Uint8Array(Module.HEAPU8.buffer, ptr, nbytes);
}

/** Free a heap array. */
function free(heapArray) {
    Module._free(heapArray.byteOffset);
}

function bart_version() {
    return _bart_version;
}