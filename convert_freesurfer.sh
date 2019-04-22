#!/bin/bash

set -e
set -x

mri_convert testdata/output/mri/aparc+aseg.mgz  testdata/aparc+aseg.nii.gz

#mris_convert --to-scanner testdata/output/surf/lh.inflated.H testdata/lh.inflated.H.vtk #doesn't work
#mris_convert --to-scanner testdata/output/surf/lh.inflated.K testdata/lh.inflated.K.vtk #doesn't work

#these are slightly different from lh.pial, but I am not sure what they are for..
#-rw-r-x--- 1 hayashis hayashis  6004482 Apr 20 16:14 lh.pial.deformed
#-rw-r-x--- 1 hayashis hayashis  6005456 Apr 20 16:14 lh.pial.one
#-rw-r-x--- 1 hayashis hayashis  6005046 Apr 20 16:14 lh.pial.preT2
#-rw-r-x--- 1 hayashis hayashis  6005050 Apr 20 16:14 lh.pial.preT2.two
#-rw-r-x--- 1 hayashis hayashis  6005228 Apr 20 16:14 lh.pial.T2
#-rw-r-x--- 1 hayashis hayashis  6005232 Apr 20 16:14 lh.pial.T2.two
#mris_convert --to-scanner testdata/output/surf/lh.pial.deformed testdata/lh.pial.deformed.vtk
#mris_convert --to-scanner testdata/output/surf/lh.pial.one testdata/lh.pial.one.vtk
#mris_convert --to-scanner testdata/output/surf/lh.pial.preT2 testdata/lh.pial.preT2.vtk
#mris_convert --to-scanner testdata/output/surf/lh.pial.preT2.two testdata/lh.pial.preT2.two.vtk
#mris_convert --to-scanner testdata/output/surf/lh.pial.T2 testdata/lh.pial.T2.vtk
#mris_convert --to-scanner testdata/output/surf/lh.pial.T2.two testdata/lh.pial.T2.two.vtk

mris_convert --to-scanner testdata/output/surf/lh.white testdata/lh.white.vtk
mris_convert --to-scanner testdata/output/surf/rh.white testdata/rh.white.vtk

mris_convert --to-scanner testdata/output/surf/lh.pial testdata/lh.pial.vtk
mris_convert --to-scanner testdata/output/surf/rh.pial testdata/rh.pial.vtk

mris_convert --to-scanner testdata/output/surf/lh.sphere testdata/lh.sphere.vtk
mris_convert --to-scanner testdata/output/surf/rh.sphere testdata/rh.sphere.vtk

mris_convert --to-scanner testdata/output/surf/lh.inflated testdata/lh.inflated.vtk
mris_convert --to-scanner testdata/output/surf/rh.inflated testdata/rh.inflated.vtk


