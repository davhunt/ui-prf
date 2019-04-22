#!/usr/bin/env python

import vtk
import sys
import os
import json
import pandas as pd

# import the binary nifti image
reader = vtk.vtkNIFTIImageReader()
reader.SetFileName('testdata/aparc+aseg.nii.gz')
reader.Update()

def genvtk(id, filename):
    # do marching cubes to create a surface
    surface = vtk.vtkDiscreteMarchingCubes()
    surface.SetInputConnection(reader.GetOutputPort())

    surface.GenerateValues(1, id, id) # (number of surfaces, label range start, label range end)
    surface.Update()

    smoother = vtk.vtkWindowedSincPolyDataFilter()
    smoother.SetInputConnection(surface.GetOutputPort())
    smoother.SetNumberOfIterations(10)
    smoother.NonManifoldSmoothingOn()
    smoother.NormalizeCoordinatesOn()
    smoother.Update()

    connectivityFilter = vtk.vtkPolyDataConnectivityFilter()
    connectivityFilter.SetInputConnection(smoother.GetOutputPort())
    connectivityFilter.SetExtractionModeToLargestRegion()
    connectivityFilter.Update()

    untransform = vtk.vtkTransform()
    untransform.SetMatrix(reader.GetQFormMatrix())
    untransformFilter=vtk.vtkTransformPolyDataFilter()
    untransformFilter.SetTransform(untransform)
    untransformFilter.SetInputConnection(connectivityFilter.GetOutputPort())
    untransformFilter.Update()

    cleaned = vtk.vtkCleanPolyData()
    cleaned.SetInputConnection(untransformFilter.GetOutputPort())
    cleaned.Update()

    #deci = vtk.vtkDecimatePro()
    #deci.SetInputConnection(cleaned.GetOutputPort())
    #deci.SetTargetReduction(0.5)
    #deci.PreserveTopologyOn()

    writer = vtk.vtkPolyDataWriter()
    writer.SetInputConnection(cleaned.GetOutputPort())
    writer.SetFileName(filename)
    writer.Write()

#https://surfer.nmr.mgh.harvard.edu/fswiki/FsTutorial/AnatomicalROI/FreeSurferColorLUT
#1011    ctx-lh-lateraloccipital             20  30  140 0
#2011    ctx-rh-lateraloccipital             20  30  140 0

genvtk(1011, "testdata/ctx-lh-lateraloccipital.vtk")
genvtk(2011, "testdata/ctx-rh-lateraloccipital.vtk")
print("all done")
