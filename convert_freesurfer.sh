#!/bin/bash

set -e
set -x

#mri_convert testdata/output/mri/aparc+aseg.mgz  testdata/aparc+aseg.nii.gz

mris_convert --to-scanner testdata/output/surf/lh.white testdata/lh.white.vtk
mris_convert --to-scanner testdata/output/surf/rh.white testdata/rh.white.vtk

mris_convert --to-scanner testdata/output/surf/lh.pial testdata/lh.pial.vtk
mris_convert --to-scanner testdata/output/surf/rh.pial testdata/rh.pial.vtk

mris_convert --to-scanner testdata/output/surf/lh.sphere testdata/lh.sphere.vtk
mris_convert --to-scanner testdata/output/surf/rh.sphere testdata/rh.sphere.vtk

mris_convert --to-scanner testdata/output/surf/lh.inflated testdata/lh.inflated.vtk
mris_convert --to-scanner testdata/output/surf/rh.inflated testdata/rh.inflated.vtk


