#define _USE_MATH_DEFINES
#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>
#include <math.h>
#include <time.h>
#include <complex.h>

//#include "fft.h"
//#include "fft2.h"
//#include "fft3.h"
#include "kspace_filter.h"
#include "tinycs.h"
#include "noise.h"
#include "stdbool.h"

#include "num/fft.h"

//#include "_kiss_fft_guts.h"
#include "params.h"

#define NA_SCALE 140

const float na_vol = 0.7;
const float na_t2fr = 60;
const float na_mm = 140;
const float na_t1 = 39.2;

static inline void normalizecimage(complex float* cimage, struct Params *p) {
    double max = 0;
    switch(p->sequence) {
        case Na:
        case NaTQ:
        case NaSQ:
            max = creal(cimage[0]);
            for(int i=0;i<p->iydim*p->izdim*p->ixdim;i++) {
                if (max < creal(cimage[i])) {
                    max = creal(cimage[i]);
                }
            }
            for(int i=0;i<p->iydim*p->izdim*p->ixdim;i++) {
                cimage[i]=creal(cimage[i])/max+0*I;
            }
            break;
        default:
            break;
    }
}

int call_count = 0;
static inline double simVoxel(struct Params *p, int pos, struct Dataset *ds) {
    double te, tr, ti, fa, tau1, tau2, te_end, te_step, e_tr_t1, e_tr_t2, cfa, sfa, s, m;
    double pd, t1, t2, t2s, t2f, ex_frac;
    call_count += 1;
    s = 0;
    if(pos >= ds->k_xdim*ds->k_ydim*ds->k_zdim) {
        fprintf(stdout, "%i\n", pos);
        return 0;
    }
    switch(p->sequence) {
        case SE:
            te = p->s_params[0];
            tr = p->s_params[1];
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2 = ds->t2[pos];
            s = fabs(pd*exp(-te/t2)*(1.0-exp(-tr/t1)));
            break;
        case IR:
            te = p->s_params[0];
            tr = p->s_params[1];
            ti = p->s_params[2];
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2 = ds->t2[pos];
            s = fabs(pd*(1.0-2.0*exp(-ti/t1)+exp(-tr/ti))*exp(-te/t2));
            break;
        case bSSFP:
            te = p->s_params[0];
            tr = p->s_params[1];
            fa = p->s_params[2] * M_PI / 180.0;
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2 = ds->t2[pos];
            e_tr_t1 = exp(-tr/t1);
            e_tr_t2 = exp(-tr/t2);
            sfa = sin(fa);
            cfa = cos(fa);
            s = fabs(pd*sfa*(1.0-e_tr_t1)/(1.0-(e_tr_t1-e_tr_t2)*cfa-e_tr_t1*e_tr_t2)*exp(-te/t2) );
            break;
        case pcbSSFP:
            te = p->s_params[0];
            tr = p->s_params[1];
            fa = p->s_params[2] * M_PI / 180.0;
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2 = ds->t2[pos];
            e_tr_t1 = exp(-tr/t1);
            e_tr_t2 = exp(-tr/t2);
            sfa = sin(fa);
            cfa = cos(fa);
            // https://onlinelibrary.wiley.com/action/downloadSupplement?doi=10.1002%2Fmrm.29302&file=mrm29302-sup-0001-supinfo.pdf
            break;
        case FISP:
            te = p->s_params[0];
            tr = p->s_params[1];
            fa = p->s_params[2] * M_PI / 180.0;
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2 = ds->t2[pos];
            t2s = ds->t2s[pos];
            e_tr_t1 = exp(-tr/t1);
            e_tr_t2 = exp(-tr/t2);
            sfa = sin(fa);
            cfa = cos(fa);
            s = fabs(pd*sfa/(1+cfa) * (1 - (e_tr_t1-cfa)*sqrt((1-e_tr_t2*e_tr_t2)/( (1-e_tr_t1*cfa)*(1-e_tr_t1*cfa)-e_tr_t2*e_tr_t2*(e_tr_t1-cfa)*(e_tr_t1-cfa) ) ) ) * exp(-te/t2s));
            break;
        case PSIF:
            te = p->s_params[0];
            tr = p->s_params[1];
            fa = p->s_params[2] * M_PI / 180.0;
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2 = ds->t2[pos];
            e_tr_t1 = exp(-tr/t1);
            e_tr_t2 = exp(-tr/t2);
            sfa = sin(fa);
            cfa = cos(fa);
            s = fabs(pd * sfa/(1+cfa)*(1-(1-e_tr_t1*cfa)*sqrt((1-e_tr_t2*e_tr_t2) /( (1-e_tr_t1*cfa)*(1-e_tr_t1*cfa)-e_tr_t2*e_tr_t2*(e_tr_t1-cfa)*(e_tr_t1-cfa) ))) * exp(-te/t2));
            break;
        case SGRE:
            te = p->s_params[0];
            tr = p->s_params[1];
            fa = p->s_params[2] * M_PI / 180.0;
            pd = ds->pd[pos];
            t1 = ds->t1[pos];
            t2s = ds->t2s[pos];
            sfa = sin(fa);
            cfa = cos(fa);
            e_tr_t1 = exp(-tr/t1);
            s = fabs(pd * (1-e_tr_t1)*sfa/(1-e_tr_t1*cfa) * exp(-te/t2s));
            break;
        case Na:
            te = p->s_params[0];
            tr = p->s_params[1];
            ex_frac = ds->na_ex_frac[pos];
            t1 = ds->na_t1[pos];
            t2s = ds->na_t2s[pos];
            t2f = ds->na_t2f[pos];
            pd = ds->na_mm[pos];
            if(t2f==0) {
                s = fabs((na_vol-ex_frac)*pd* (1-exp(-tr/t1)) * (0.6 + 0.4*exp(-te/t2s)) + ex_frac*na_mm* (1-exp(-tr/na_t1))*exp(-te/na_t2fr)) / NA_SCALE;
            } else {
            s = fabs((na_vol-ex_frac)*pd* (1-exp(-tr/t1)) * (0.6*exp(-te/t2f) + 0.4*exp(-te/t2s)) + ex_frac*na_mm* (1-exp(-tr/na_t1))*exp(-te/na_t2fr)) / NA_SCALE;
            }
            break;
        case NaSQ:
            fa = p->s_params[0] * M_PI / 180;
            tau1 = p->s_params[1];
            te = p->s_params[2];
            te_end = p->s_params[3];
            te_step = p->s_params[4];
            t2s = ds->na_t2s[pos];
            t2f = ds->na_t2f[pos];
            pd = ds->na_mm[pos];
            sfa = sin(fa);
            s = 0;
            m = 0;
            for(;te<=te_end;te+=te_step) {
                m++;
                if(t2f == 0) {
                    s += fabs(pd*(exp(-(te+tau1)/t2s) + 1)*sfa);
                } else {
                    s += fabs(pd*(exp(-(te+tau1)/t2s) + exp(-(te+tau1)/t2f))*sfa);
                }
            }
            s /= m;
            break;
        case NaTQ:
            fa = p->s_params[0] * M_PI / 180;
            tau1 = p->s_params[1];
            tau2 = p->s_params[2];
            te = p->s_params[3];
            te_end = p->s_params[4];
            te_step = p->s_params[5];
            t2s = ds->na_t2s[pos];
            t2f = ds->na_t2f[pos];
            pd = ds->na_mm[pos];
            sfa = sin(fa);
            s = 0;
            m = 0;
            for(;te<=te_end;te+=te_step) {
                m++;
                if(t2f==0) {
                    s += fabs(pd*( (exp(-te/t2s) - 1) * (exp(-tau1/t2s)-1) * exp(-tau2/t2s) * (sfa*sfa*sfa*sfa*sfa) ));
                } else {
                    s += fabs(pd*( (exp(-te/t2s) - exp(-te/t2f)) * (exp(-tau1/t2s)-exp(-tau1/t2f)) * exp(-tau2/t2s) * (sfa*sfa*sfa*sfa*sfa) ));
                }
            }
            s /= m;
            break;
        case NaTQSQ:
            fa = p->s_params[0] * M_PI / 180;
            tau1 = p->s_params[1];
            tau2 = p->s_params[2];
            te = p->s_params[3];
            te_end = p->s_params[4];
            te_step = p->s_params[5];
            t2s = ds->na_t2s[pos];
            t2f = ds->na_t2f[pos];
            pd = ds->na_mm[pos];
            sfa = sin(fa);
            e_tr_t1 = 0;
            m = 0;
            for(;te<=te_end;te+=te_step) {
                m++;
                if(t2f==0) {
                    e_tr_t1 += fabs(pd*( (exp(-te/t2s) - 1) * (exp(-tau1/t2s)-1) * exp(-tau2/t2s) * (sfa*sfa*sfa*sfa*sfa) ));
                } else {
                    e_tr_t1 += fabs(pd*( (exp(-te/t2s) - exp(-te/t2f)) * (exp(-tau1/t2s)-exp(-tau1/t2f)) * exp(-tau2/t2s) * (sfa*sfa*sfa*sfa*sfa) ));
                }
            }
            e_tr_t1 /= m*NA_SCALE;
            fa = p->s_params[6] * M_PI / 180;
            tau1 = p->s_params[7];
            te = p->s_params[8];
            te_end = p->s_params[9];
            te_step = p->s_params[10];
            sfa = sin(fa);
            e_tr_t2 = 0;
            m = 0;
            for(;te<=te_end;te+=te_step) {
                m++;
                if(t2f == 0) {
                    e_tr_t2 += fabs(pd*(exp(-(te+tau1)/t2s) + 1)*sfa);
                } else {
                    e_tr_t2 += fabs(pd*(exp(-(te+tau1)/t2s) + exp(-(te+tau1)/t2f))*sfa);
                }
            }
            e_tr_t2 /= m*NA_SCALE;
            s = e_tr_t1 / e_tr_t2;
            break;
        case NaTQF:
            te = p->s_params[0];
            fa = p->s_params[1] * M_PI / 180;
            tau1 = p->s_params[2];
            tau2 = p->s_params[3];
            t2s = ds->na_t2s[pos];
            t2f = ds->na_t2f[pos];
            pd = ds->na_mm[pos];
            sfa = sin(fa);
            cfa = cos(fa);
            if(t2f==0) {
                s = fabs(pd*(exp(-te/t2s)-1) * (exp(-tau1/t2s)-1) * exp(-tau2/t2s) * (sfa*sfa*sfa*sfa*sfa));
            } else {
                s = fabs(pd*(exp(-te/t2s)-exp(-te/t2f)) * (exp(-tau1/t2s)-exp(-tau1/t2f)) * exp(-tau2/t2s) * (sfa*sfa*sfa*sfa*sfa));
            }
            break;
    }
    return s;
}

double ssim(complex float* img1, complex float* img2, int size) {
    double mu1, mu2, var1, var2, sig_co, c1, c2, L, k1, k2;
    k1 = 0.01;
    k2 = 0.03;
    //L = pow(2.0, sizeof(kiss_fft_scalar)*8)-1;
    L = 0;
    for(int i=0;i<size;i++) {
        if(creal(img1[i]) > L) {
            L = creal(img1[i]);
        }
    }
    c1 = (L*k1)*(L*k1);
    c2 = (L*k2)*(L*k2);
    mu1 = 0.0;
    mu2 = 0.0;
    for(int i=0;i<size;i++) {
        mu1 += creal(img1[i]);
        mu2 += creal(img2[i]);
    }
    mu1 /= size;
    mu2 /= size;
    var1 = 0.0;
    var2 = 0.0;
    sig_co = 0.0;
    for(int i=0;i<size;i++) {
        var1 += (mu1-creal(img1[i]))*(mu1-creal(img1[i]));
        var2 += (mu2-creal(img2[i]))*(mu2-creal(img2[i]));
        sig_co += (mu2-creal(img2[i]))*(mu1-creal(img1[i]));
    }
    var1 /= size;
    var2 /= size;
    sig_co /= size;
    double ssim = (2.0*mu1*mu2+c1)*(2.0*sig_co+c2)/((mu1*mu1+mu2*mu2+c1)*(var1+var2+c2));
    //fprintf(stdout, "ssim: %f\n", ssim);
    return ssim;
}

void simulate(struct Params *p, complex float *cimage, complex float *kspace, complex float *filt_cimage, complex float *filt_kspace, complex float *cs_cimage, complex float *cs_kspace, struct Dataset *ds) {
    int x,y,z,ipos,ds_pos;
    double nx,ny,nz;
    int xi,x_start,x_end,yi,y_start,y_end,zi,z_start,z_end;
    double xs,ys,zs;
    double s,d;

    srand(time(0));

    call_count = 0;
    xs = (double)ds->k_xdim/(double)p->xdim/2.0;
    ys = (double)ds->k_ydim/(double)p->ydim/2.0;
    zs = (double)ds->k_zdim/(double)p->zdim/2.0;

    for(int i=0;i<p->izdim*p->iydim*p->ixdim;i++) {
        cimage[i] =  0+ 0*I;
        kspace[i] =  0+ 0*I;
    }
    if(p->use_cs && cs_cimage != NULL) {
        for(int i=0;i<p->izdim*p->iydim*p->ixdim;i++) {
            filt_cimage[i] =  0+ 0*I;
            filt_kspace[i] =  0+ 0*I;
            cs_cimage[i] =  0+ 0*I;
            cs_kspace[i] =  0+ 0*I;
        }
    }
    
    

    for(z = 0; z<p->zdim; z++) {
        nz = (double)z*(double)ds->k_zdim/(double)p->zdim + zs;
        for(y = 0;y<p->ydim; y++) {
            ny = (double)y*(double)ds->k_ydim/(double)p->ydim + ys;
            for(x = 0;x<p->xdim; x++) {
                ipos = z*p->ixdim*p->iydim + y*p->ixdim + x;
                d = 0; s = 0;
                nx = (double)x*(double)ds->k_xdim/(double)p->xdim + xs;
                switch (p->nearest) {
                    case Nearest:
                        ds_pos = round(nz-0.5)*ds->k_xdim*ds->k_ydim+round(ny-0.5)*ds->k_xdim+round(nx-0.5);
                        s = simVoxel(p, ds_pos, ds);
                        break;
                    case KNearest:
                        ds_pos = floor(nz)*ds->k_xdim*ds->k_ydim+floor(ny)*ds->k_xdim+floor(nx);
                        s = simVoxel(p, ds_pos, ds);
                        ds_pos = floor(nz)*ds->k_xdim*ds->k_ydim+floor(ny)*ds->k_xdim+ceil(nx);
                        s += simVoxel(p, ds_pos, ds);
                        ds_pos = floor(nz)*ds->k_xdim*ds->k_ydim+ceil(ny)*ds->k_xdim+floor(nx);
                        s += simVoxel(p, ds_pos, ds);
                        ds_pos = floor(nz)*ds->k_xdim*ds->k_ydim+ceil(ny)*ds->k_xdim+ceil(nx);
                        s += simVoxel(p, ds_pos, ds);
                        ds_pos = ceil(nz)*ds->k_xdim*ds->k_ydim+floor(ny)*ds->k_xdim+floor(nx);
                        s += simVoxel(p, ds_pos, ds);
                        ds_pos = ceil(nz)*ds->k_xdim*ds->k_ydim+floor(ny)*ds->k_xdim+ceil(nx);
                        s += simVoxel(p, ds_pos, ds);
                        ds_pos = ceil(nz)*ds->k_xdim*ds->k_ydim+ceil(ny)*ds->k_xdim+floor(nx);
                        s += simVoxel(p, ds_pos, ds);
                        ds_pos = ceil(nz)*ds->k_xdim*ds->k_ydim+ceil(ny)*ds->k_xdim+ceil(nx);
                        s += simVoxel(p, ds_pos, ds);
                        s /= 8.0;
                        break;
                    case Average:
                    default:
                        x_start=floor(nx-xs);
                        x_end=ceil(x_start+2*xs);
                        y_start=floor(ny-ys);
                        y_end=ceil(y_start+2*ys);
                        z_start=floor(nz-zs);
                        z_end=ceil(z_start+2*zs);
                        for(xi=x_start;xi<x_end;xi+=1) {
                            for(yi=y_start;yi<y_end;yi+=1) {
                                for(zi=z_start;zi<z_end;zi+=1) {
                                    if(zi>=0&&zi<ds->k_zdim&&yi>=0&&yi<ds->k_ydim&&xi>=0&&xi<ds->k_xdim) {
                                        ds_pos = zi*ds->k_xdim*ds->k_ydim+yi*ds->k_xdim+xi;
                                        s += simVoxel(p, ds_pos, ds);
                                        d += 1.0;
                                    }
                                }
                            }
                        }
                        s /= d;
                        break;
                }
                cimage[ipos] =  s+ 0*I;
            }
        }
    }

    normalizecimage(cimage, p);

    addImageNoise(cimage, p);
    long dims3[] = {p->iydim, p->ixdim, p->izdim};
    long dims2[] = {p->iydim, p->ixdim};
    if(p->use_fft3) {
        fft(3, dims3, 7, kspace, cimage);
        //kfft(cimage, kspace, p->iydim, p->izdim, p->ixdim);
    } else {
        for(z=0;z<p->zdim;z++) {
            fft(2, dims2, 3, &kspace[z*p->ixdim*p->iydim], &cimage[z*p->ixdim*p->iydim]);
            //kfft(&cimage[z*p->ixdim*p->iydim], &kspace[z*p->ixdim*p->iydim], p->ixdim, p->iydim);
        }
    }

    bool modified = addKSpaceNoise(kspace, p);
    
    if(p->use_cs && cs_cimage != NULL) {
        //modified = true;
        apply_kspace_filter(kspace, filt_kspace, p);
        if(p->use_fft3) {
            ifft(3, dims3, 7, filt_cimage, filt_kspace);
            //kifft3d(filt_kspace, filt_cimage, p->iydim, p->izdim, p->ixdim);
        } else {
            for(z=0;z<p->zdim;z++) {
                ifft(2, dims2, 3, &filt_cimage[z*p->ixdim*p->iydim], &filt_kspace[z*p->ixdim*p->iydim]);
                //kifft2d(&filt_kspace[z*p->ixdim*p->iydim], &filt_cimage[z*p->ixdim*p->iydim], p->ixdim, p->iydim);
            }
        }
        for(int i=0;i<p->ixdim*p->iydim*p->izdim;i++) {
            cs_kspace[i] = filt_kspace[i];
            cs_cimage[i] = 0+0*I;
        }
        if(p->use_fft3) {
            compressed_sensing(cs_kspace, cs_cimage, p);
        } else {
            for(z=0;z<p->zdim;z++) {
                if (p->cs_params->callback != 0) {
                    ((cs_callback*)p->cs_params->callback)(z+1);
                } else {
                    fprintf(stderr, "%d\n", z);
                }
                compressed_sensing(&cs_kspace[z*p->ixdim*p->iydim], &cs_cimage[z*p->ixdim*p->iydim], p);
            }
        }
        /*double s;
        for(z=0;z<p->zdim;z++) {
            s = ssim(&cimage[z*p->xdim*p->ydim], &cs_cimage[z*p->xdim*p->ydim], p->xdim*p->ydim);
            fprintf(stdout, "ssim %d: %f ", z, s);
        }
        s = ssim(cimage, cs_cimage, p->xdim*p->ydim);
        fprintf(stdout, "ssim: %f l1: %f l2: %f mu: %f gam: %f ninner: %d nreg: %d\n", s, p->cs_params->lambda, p->cs_params->lambda2, p->cs_params->mu, p->cs_params->gam, p->cs_params->ninner, p->cs_params->nbreg);
        */
    } else {
        modified = apply_kspace_filter(kspace, kspace, p) || modified;
    }
    
    if(modified) {
        if(p->use_fft3) {
            ifft(3, dims3, 7, filt_cimage, filt_kspace);
            //kifft3d(kspace, cimage, p->iydim, p->izdim, p->ixdim);
        } else {
            for(z=0;z<p->zdim;z++) {
                ifft(2, dims2, 3, &filt_cimage[z*p->ixdim*p->iydim], &filt_kspace[z*p->ixdim*p->iydim]);
                //kifft2d(&kspace[z*p->ixdim*p->iydim], &cimage[z*p->ixdim*p->iydim], p->ixdim, p->iydim);
            }
        }
        modified = 0;
    }
    //fprintf(stdout, "voxel sim call count: %d overlap: %f\n", call_count, (double)call_count/(256.0*256.0*256.0));
}