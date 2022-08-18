self.importScripts("a.out.js");

const scalar_size = 4;

function make_dataset(pd, t1, t2, t2s, na_mm, na_t1, na_ex_frac, na_t2s, na_t2f) {
    pd_buff = allocFromArray(pd);
    pd_ptr = pd_buff.byteOffset;
    t1_buff = allocFromArray(t1);
    t1_ptr = t1_buff.byteOffset;
    t2_buff = allocFromArray(t2);
    t2_ptr = t2_buff.byteOffset;
    t2s_buff = allocFromArray(t2s);
    t2s_ptr = t2s_buff.byteOffset;
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
    dataset = _make_dataset(256,256,256,pd_ptr, t1_ptr, t2_ptr, t2s_ptr, na_mm_ptr, na_t1_ptr, na_ex_frac_ptr, na_t2s_ptr, na_t2f_ptr);
    return dataset;
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
    var use_cs = "cs" in params ? params["cs"]>1 : false;
    var cs_params = make_cs_params(params);
    c_params = _make_params(sequence_enum[params["sequence"]], n_params, s_params.byteOffset, params["xdim"], params["ydim"], params["zdim"], params["nearest"], use_cs, fft3d, cs_params)
    return c_params;
}

function simulate_fast(ds, params) {
    var xdim = Math.round(params["xdim"]);
    xdim = xdim > 0 ? xdim : k_xdim;
    xdim = xdim > k_xdim ? k_xdim : xdim;
    var ydim = Math.round(params["ydim"]);
    ydim = ydim > 0 ? ydim : k_ydim;
    ydim = ydim > k_ydim ? k_ydim : ydim;
    var zdim = Math.round(params["zdim"]);
    zdim = zdim > 0 ? zdim : k_zdim;
    zdim = zdim > k_zdim ? k_zdim : zdim;

    var image_buff = alloc(xdim*ydim*zdim*scalar_size*2);
    var image_ptr = image_buff.byteOffset;
    var kspace_buff = alloc(xdim*ydim*zdim*scalar_size*2);
    var kspace_ptr = kspace_buff.byteOffset;

    p = make_params(params)
    _simulate(p, image_ptr, kspace_ptr, ds);
    var in_image = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, image_ptr, xdim*ydim*zdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, image_ptr, xdim*ydim*zdim*2));
    var image = scalar_size==4?new Float32Array(xdim*ydim*zdim):new Float64Array(xdim*ydim*zdim);
    for(var i = 0;i<image.length;i++) {
        image[i] = in_image[i*2];
    }
    var kspace = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, kspace_ptr, xdim*ydim*zdim*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, kspace_ptr, xdim*ydim*zdim*2));

    free(p);
    Module._free(image_ptr);
    Module._free(kspace_ptr);

    return [image, kspace];
}

function make_cs_params(params) {
    
    var xdim = Math.round(params["xdim"]);
    xdim = xdim > 0 ? xdim : k_xdim;
    xdim = xdim > k_xdim ? k_xdim : xdim;
    var ydim = Math.round(params["ydim"]);
    ydim = ydim > 0 ? ydim : k_ydim;
    ydim = ydim > k_ydim ? k_ydim : ydim;
    var zdim = Math.round(params["zdim"]);
    zdim = zdim > 0 ? zdim : k_zdim;
    zdim = zdim > k_zdim ? k_zdim : zdim;
    
    var ninner = "cs_ninner" in params ? parseInt(params["cs_ninner"]) : 1;
    var nbreg = "cs_nbreg" in params ? parseInt(params["cs_nbreg"]) : 80;
    var lambda = "cs_lambda1" in params ? parseFloat(params["cs_lambda1"]):1.0;
    var lambda2 = "cs_lambda2" in params? parseFloat(params["cs_lambda2"]):0.15;
    var mu = "cs_mu" in params ? params["cs_mu"] : 1.0;
    var gam = "cs_gam" in params? parseFloat(params["cs_gam"]):1;
    
    var cs_params = _make_cs_params(xdim, ydim, zdim, ninner, nbreg, lambda, lambda2, mu, gam)
    return cs_params;
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
    
    var cs_params = make_cs_params(params);
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
    
    free(cs_params);
    free(f_data);
    free(out);

    return [img, kspace];
}

/** Compute the FFT of a real-valued mxn matrix. */
function fft(data, m) {
    /* Allocate input and output arrays on the heap. */
    var heapData = scalar_size==4 ? allocFromArray(data) : allocFromArray(Float64Array.from(data));
    var heapSpectrum = alloc(2*m*scalar_size);

    _fft(heapData.byteOffset, heapSpectrum.byteOffset, m);

    /* Get spectrum from the heap, copy it to local array. */
    var spectrum = new Float32Array(m*2);
    if(scalar_size==8) {
        var tmp = new Float64Array(Module.HEAPU8.buffer, heapSpectrum.byteOffset, m*2);
        for(var i=0;i<tmp.length;i++) { spectrum[i] = tmp[i]; }
    } else {
        spectrum.set(new Float32Array(Module.HEAPU8.buffer, heapSpectrum.byteOffset, m*2));
    }   

    /* Free heap objects. */
    free(heapData);
    free(heapSpectrum);

    return spectrum;
}

/** Compute the inverse FFT of a real-valued mxn matrix. */
function ifft(spectrum, m) {
    var heapSpectrum = scalar_size==4 ? allocFromArray(spectrum) : allocFromArray(Float64Array.from(spectrum));
    var heapData = alloc(2*m*scalar_size);

    _ifft(heapSpectrum.byteOffset, heapData.byteOffset, m);

    var data = scalar_size==4 ? Float32Array.from(new Float32Array(Module.HEAPU8.buffer,heapData.byteOffset, m*2)): Float32Array.from(new Float64Array(Module.HEAPU8.buffer,heapData.byteOffset, m*2));

    //for (i=0;i<m*2;i++) {
        //data[i] /= m;
    //}

    free(heapSpectrum);
    free(heapData);

    return data;
}

/** Compute the FFT of a real-valued mxn matrix. */
function kfft2d(data, m, n) {
    /* Allocate input and output arrays on the heap. */
    var heapData = scalar_size==4?allocFromArray(data):allocFromArray(Float64Array.from(data));
    var heapSpectrum = alloc(2*m*n*scalar_size);

    _fft2d(heapData.byteOffset, heapSpectrum.byteOffset, m, n);

    /* Get spectrum from the heap, copy it to local array. */
    var spectrum = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, heapSpectrum.byteOffset, m*n*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, heapSpectrum.byteOffset, m*n*2));

    /* Free heap objects. */
    free(heapData);
    free(heapSpectrum);

    return spectrum;
}

/** Compute the inverse FFT of a real-valued mxn matrix. */
function kifft2d(spectrum, m, n) {
    var heapSpectrum = scalar_size==4?allocFromArray(spectrum):allocFromArray(Float64Array.from(spectrum));
    var heapData = alloc(2*m*n*scalar_size);

    _ifft2d(heapSpectrum.byteOffset, heapData.byteOffset, m, n);

    var data = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, heapData.byteOffset, m*n*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, heapData.byteOffset, m*n*2));

    //for (i=0;i<m*n*2;i++) {
        //data[i] /= m*n;
    //}

    free(heapSpectrum);
    free(heapData);

    return data;
}

/** Compute the FFT of a real-valued mxn matrix. */
function kfft3d(data, m, n, l) {
    /* Allocate input and output arrays on the heap. */
    var heapData = scalar_size==4?allocFromArray(data):allocFromArray(Float64Array.from(data));
    var heapData_ptr = heapData.byteOffset;
    var heapSpectrum = alloc(2*m*n*l*scalar_size);
    var heapSpectrum_ptr = heapSpectrum.byteOffset;

    _fft3d(heapData_ptr, heapSpectrum_ptr, m, n, l);

    /* Get spectrum from the heap, copy it to local array. */
    var spectrum = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer, heapSpectrum_ptr, m*n*l*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer, heapSpectrum_ptr, m*n*l*2));

    /* Free heap objects. */

    Module._free(heapData_ptr);
    Module._free(heapSpectrum_ptr);

    return spectrum;
}


/** Compute the inverse FFT of a real-valued mxn matrix. */
function kifft3d(spectrum, m, n, l) {
    var heapSpectrum = scalar_size==4?allocFromArray(spectrum):allocFromArray(Float64Array.from(spectrum));
    var heapData = alloc(m*n*l*scalar_size);

    _ifft3d(heapSpectrum.byteOffset, heapData.byteOffset, m, n, l);

    var data = scalar_size==4?Float32Array.from(new Float32Array(Module.HEAPU8.buffer,heapData.byteOffset, m*n*l*2)):Float32Array.from(new Float64Array(Module.HEAPU8.buffer,heapData.byteOffset, m*n*l*2));

    //for (i=0;i<m*n*l*2;i++) {
        //data[i] /= m*n*l;
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
    var ptr = Module._malloc(nbytes);
    return new Uint8Array(Module.HEAPU8.buffer, ptr, nbytes);
}


/** Free a heap array. */
function free(heapArray) {
    Module._free(heapArray.byteOffset);
}
