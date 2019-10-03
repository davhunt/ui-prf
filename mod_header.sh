#!/bin/bash

vol=$1

gunzip $vol.gz

nifti_tool -mod_hdr -mod_field srow_x '-1.250000 0.000000 0.000000 90.000000' -prefix new_vol.nii -infiles $vol
nifti_tool -mod_hdr -mod_field srow_y '0.000000 1.250000 0.000000 -126.000000' -prefix new_vol1.nii -infiles new_vol.nii
nifti_tool -mod_hdr -mod_field srow_z '0.000000 0.000000 1.250000 -72.000000' -prefix new_vol2.nii -infiles new_vol1.nii
nifti_tool -mod_hdr -mod_field qoffset_x '90.000000' -prefix new_vol3.nii -infiles new_vol2.nii
nifti_tool -mod_hdr -mod_field qoffset_y '-126.000000' -prefix new_vol4.nii -infiles new_vol3.nii
nifti_tool -mod_hdr -mod_field qoffset_z '-72.000000' -prefix new_vol5.nii -infiles new_vol4.nii

gzip new_vol5.nii && mv new_vol5.nii.gz $vol.gz

rm $vol new_vol.nii new_vol1.nii new_vol2.nii new_vol3.nii new_vol4.nii
