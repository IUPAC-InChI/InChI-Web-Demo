#!/bin/sh
if [ "$#" -ne 4 ]; then
    echo "Usage:" >&2
    echo "$0 <inchi-1> <test-datasets> <test-results> <test-logs>" >&2
    echo "<inchi-1>: path to inchi-1 executable" >&2
    echo "<test-datasets>: test-datasets directory" >&2
    echo "<test-results>: directory which inchi-1 writes output to" >&2
    echo "<test-logs>: log directory" >&2
    exit 1
fi

INCHI_1=$1
TEST_DATASETS=$2
TEST_RESULTS=$3
TEST_LOGS=$4

if [ ! -d $TEST_RESULTS ]; then
    mkdir -p $TEST_RESULTS
fi
if [ ! -d $TEST_LOGS ]; then
    mkdir -p $TEST_LOGS
fi

#
# Standard InChI
#
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-std-01.inc $TEST_LOGS/its-std-01.log NUL -AuxNone -OutErrINCHI -NoLabels -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-std-02.inc $TEST_LOGS/its-std-02.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-std-03.inc $TEST_LOGS/its-std-03.log NUL -AuxNone -OutErrINCHI -NoLabels -SNon -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-std-04.inc $TEST_LOGS/its-std-04.log NUL -AuxNone -OutErrINCHI -NoLabels -DoNotAddH
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-std-05.inc $TEST_LOGS/its-std-05.log NUL -AuxNone -OutErrINCHI -NoLabels -SNon -DoNotAddH
#
# Non-standard InChI
#
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-01.inc $TEST_LOGS/its-non-std-01.log NUL -AuxNone -OutErrINCHI -NoLabels -SUU -SLUUD
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-02.inc $TEST_LOGS/its-non-std-02.log NUL -AuxNone -OutErrINCHI -NoLabels -SRel -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-03.inc $TEST_LOGS/its-non-std-03.log NUL -AuxNone -OutErrINCHI -NoLabels -SRac
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-04.inc $TEST_LOGS/its-non-std-04.log NUL -AuxNone -OutErrINCHI -NoLabels -SUU -SLUUD -SUCF
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-05.inc $TEST_LOGS/its-non-std-05.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -SRel
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-06.inc $TEST_LOGS/its-non-std-06.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -SRac
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-07.inc $TEST_LOGS/its-non-std-07.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -SLUUD -SUCF
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-08.inc $TEST_LOGS/its-non-std-08.log NUL -AuxNone -OutErrINCHI -NoLabels -FixedH -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-09.inc $TEST_LOGS/its-non-std-09.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -FixedH
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-10.inc $TEST_LOGS/its-non-std-10.log NUL -AuxNone -OutErrINCHI -NoLabels -FixedH -SNon
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-11.inc $TEST_LOGS/its-non-std-11.log NUL -AuxNone -OutErrINCHI -NoLabels -FixedH -SRel
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-12.inc $TEST_LOGS/its-non-std-12.log NUL -AuxNone -OutErrINCHI -NoLabels -RecMet -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-13.inc $TEST_LOGS/its-non-std-13.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -RecMet
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-14.inc $TEST_LOGS/its-non-std-14.log NUL -AuxNone -OutErrINCHI -NoLabels -RecMet -SNon
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-15.inc $TEST_LOGS/its-non-std-15.log NUL -AuxNone -OutErrINCHI -NoLabels -RecMet -SRel
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-16.inc $TEST_LOGS/its-non-std-16.log NUL -AuxNone -OutErrINCHI -NoLabels -FixedH -RecMet -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-17.inc $TEST_LOGS/its-non-std-17.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -FixedH -RecMet
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-18.inc $TEST_LOGS/its-non-std-18.log NUL -AuxNone -OutErrINCHI -NoLabels -FixedH -RecMet -SNon
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-19.inc $TEST_LOGS/its-non-std-19.log NUL -AuxNone -OutErrINCHI -NoLabels -FixedH -RecMet -SRel
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-20.inc $TEST_LOGS/its-non-std-20.log NUL -AuxNone -OutErrINCHI -NoLabels -KET -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-21.inc $TEST_LOGS/its-non-std-21.log NUL -AuxNone -OutErrINCHI -NoLabels -KET -SNon
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-22.inc $TEST_LOGS/its-non-std-22.log NUL -AuxNone -OutErrINCHI -NoLabels -KET -SRel
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-23.inc $TEST_LOGS/its-non-std-23.log NUL -AuxNone -OutErrINCHI -NoLabels -15T -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-24.inc $TEST_LOGS/its-non-std-24.log NUL -AuxNone -OutErrINCHI -NoLabels -15T -SNon
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-25.inc $TEST_LOGS/its-non-std-25.log NUL -AuxNone -OutErrINCHI -NoLabels -15T -SRel
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-26.inc $TEST_LOGS/its-non-std-26.log NUL -AuxNone -OutErrINCHI -NoLabels -KET -15T
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-27.inc $TEST_LOGS/its-non-std-27.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -KET -15T -Key
$INCHI_1 $TEST_DATASETS/InChI_TestSet.sdf $TEST_RESULTS/its-non-std-28.inc $TEST_LOGS/its-non-std-28.log NUL -AuxNone -OutErrINCHI -NoLabels -NEWPSOFF -KET -15T -SUU -SLUUD
