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
# Polymers/Zz atoms
#
$INCHI_1 $TEST_DATASETS/zzp.sdf $TEST_RESULTS/zzp.inc $TEST_LOGS/zzp.log NUL -AuxNone -OutErrINCHI -NoLabels -Key
$INCHI_1 $TEST_DATASETS/zzp.sdf $TEST_RESULTS/zzp-NPZZ.inc $TEST_LOGS/zzp-NPZZ.log NUL -NPZZ -AuxNone -OutErrINCHI -NoLabels
$INCHI_1 $TEST_DATASETS/zzp.sdf $TEST_RESULTS/zzp-Polymers.inc $TEST_LOGS/zzp-Polymers.log NUL -Polymers -AuxNone -OutErrINCHI -NoLabels
$INCHI_1 $TEST_DATASETS/zzp.sdf $TEST_RESULTS/zzp-Polymers-FoldCRU-NPZZ.inc $TEST_LOGS/zzp-Polymers-FoldCRU-NPZZ.log NUL -Polymers -FoldCRU -NPZZ -AuxNone -OutErrINCHI -NoLabels
$INCHI_1 $TEST_DATASETS/zzp.sdf $TEST_RESULTS/zzp-Polymers105.inc $TEST_LOGS/zzp-Polymers105.log NUL -Polymers105 -AuxNone -OutErrINCHI -NoLabels
$INCHI_1 $TEST_DATASETS/zzp.sdf $TEST_RESULTS/zzp-Polymers105-NPZZ.inc $TEST_LOGS/zzp-Polymers105-NPZZ.log NUL -Polymers105 -NPZZ -AuxNone -OutErrINCHI -NoLabels
