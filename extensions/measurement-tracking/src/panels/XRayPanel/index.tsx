import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { StudySummary, MeasurementTable, useViewportGrid } from '@ohif/ui';
import { DicomMetadataStore, utils } from '@ohif/core';
import { useDebounce } from '@hooks';
import { useTrackedMeasurements } from '../../getContextModule';
import debounce from 'lodash.debounce';
import { useTranslation } from 'react-i18next';
import { Separator } from '@ohif/ui-next';
import apiClient from '../../../../../platform/ui/src/apis/apiClient';
import { OptionEnum } from '../../../../cornerstone/src/utils/OptionEnum';
import RunModel from '../../runModelButton';
const { formatDate } = utils;

const DISPLAY_STUDY_SUMMARY_INITIAL_VALUE = {
  key: undefined, //
  date: '', // '07-Sep-2010',
  modality: '', // 'CT',
  description: '', // 'CHEST/ABD/PELVIS W CONTRAST',
};

function XRayPanel({
  servicesManager,
  extensionManager,
  renderHeader,
  getCloseIcon,
  tab,
}: withAppTypes) {
  const [viewportGrid] = useViewportGrid();
  const { t } = useTranslation('MeasurementTable');
  const [measurementChangeTimestamp, setMeasurementsUpdated] = useState(Date.now().toString());
  const debouncedMeasurementChangeTimestamp = useDebounce(measurementChangeTimestamp, 200);
  const { measurementService, uiDialogService, displaySetService, customizationService } =
    servicesManager.services;
  const [trackedMeasurements, sendTrackedMeasurementsEvent] = useTrackedMeasurements();
  const { trackedStudy, trackedSeries } = trackedMeasurements.context;
  const [displayStudySummary, setDisplayStudySummary] = useState(
    DISPLAY_STUDY_SUMMARY_INITIAL_VALUE
  );
  const [displayMeasurements, setDisplayMeasurements] = useState([]);
  const measurementsPanelRef = useRef(null);
  const searchParams = new URLSearchParams(window.location.search);
  const studyInstanceUid = searchParams.get('StudyInstanceUIDs');

  useEffect(() => {
    const measurements = measurementService.getMeasurements();
    const filteredMeasurements = measurements.filter(
      m => trackedStudy === m.referenceStudyUID && trackedSeries.includes(m.referenceSeriesUID)
    );

    const mappedMeasurements = filteredMeasurements.map(m =>
      _mapMeasurementToDisplay(m, measurementService.VALUE_TYPES, displaySetService)
    );
    setDisplayMeasurements(mappedMeasurements);
    // eslint-ignore-next-line
  }, [measurementService, trackedStudy, trackedSeries, debouncedMeasurementChangeTimestamp]);

  const updateDisplayStudySummary = async () => {
    if (trackedMeasurements.matches('tracking')) {
      const StudyInstanceUID = trackedStudy;
      const studyMeta = DicomMetadataStore.getStudy(StudyInstanceUID);
      const instanceMeta = studyMeta.series[0].instances[0];
      const { StudyDate, StudyDescription } = instanceMeta;

      const modalities = new Set();
      studyMeta.series.forEach(series => {
        if (trackedSeries.includes(series.SeriesInstanceUID)) {
          modalities.add(series.instances[0].Modality);
        }
      });
      const modality = Array.from(modalities).join('/');

      if (displayStudySummary.key !== StudyInstanceUID) {
        setDisplayStudySummary({
          key: StudyInstanceUID,
          date: StudyDate, // TODO: Format: '07-Sep-2010'
          modality,
          description: StudyDescription,
        });
      }
    } else if (trackedStudy === '' || trackedStudy === undefined) {
      setDisplayStudySummary(DISPLAY_STUDY_SUMMARY_INITIAL_VALUE);
    }
  };

  // ~~ DisplayStudySummary
  useEffect(() => {
    updateDisplayStudySummary();
  }, [displayStudySummary.key, trackedMeasurements, trackedStudy, updateDisplayStudySummary]);

  // TODO: Better way to consolidated, debounce, check on change?
  // Are we exposing the right API for measurementService?
  // This watches for ALL measurementService changes. It updates a timestamp,
  // which is debounced. After a brief period of inactivity, this triggers
  // a re-render where we grab up-to-date measurements
  useEffect(() => {
    const added = measurementService.EVENTS.MEASUREMENT_ADDED;
    const addedRaw = measurementService.EVENTS.RAW_MEASUREMENT_ADDED;
    const updated = measurementService.EVENTS.MEASUREMENT_UPDATED;
    const removed = measurementService.EVENTS.MEASUREMENT_REMOVED;
    const cleared = measurementService.EVENTS.MEASUREMENTS_CLEARED;
    const subscriptions = [];

    [added, addedRaw, updated, removed, cleared].forEach(evt => {
      subscriptions.push(
        measurementService.subscribe(evt, () => {
          setMeasurementsUpdated(Date.now().toString());
          if (evt === added) {
            debounce(() => {
              measurementsPanelRef.current.scrollTop = measurementsPanelRef.current.scrollHeight;
            }, 300)();
          }
        }).unsubscribe
      );
    });

    return () => {
      subscriptions.forEach(unsub => {
        unsub();
      });
    };
  }, [measurementService, sendTrackedMeasurementsEvent]);

  const jumpToImage = ({ uid, isActive }) => {
    measurementService.jumpToMeasurement(viewportGrid.activeViewportId, uid);

    onMeasurementItemClickHandler({ uid, isActive });
  };

  const onMeasurementItemEditHandler = ({ uid, isActive }) => {
    jumpToImage({ uid, isActive });
    const labelConfig = customizationService.get('measurementLabels');
    const measurement = measurementService.getMeasurement(uid);
    const utilityModule = extensionManager.getModuleEntry(
      '@ohif/extension-cornerstone.utilityModule.common'
    );
    const { showLabelAnnotationPopup } = utilityModule.exports;
    showLabelAnnotationPopup(measurement, uiDialogService, labelConfig).then(
      (val: Map<any, any>) => {
        measurementService.update(
          uid,
          {
            ...val,
          },
          true
        );
      }
    );
  };

  const onMeasurementItemClickHandler = ({ uid, isActive }) => {
    if (!isActive) {
      const measurements = [...displayMeasurements];
      const measurement = measurements.find(m => m.uid === uid);

      measurements.forEach(m => (m.isActive = m.uid !== uid ? false : true));
      measurement.isActive = true;
      setDisplayMeasurements(measurements);
    }
  };

  const displayMeasurementsWithoutFindings = displayMeasurements.filter(
    dm => dm.measurementType !== measurementService.VALUE_TYPES.POINT && dm.referencedImageId
  );
  const additionalFindings = displayMeasurements.filter(
    dm => dm.measurementType === measurementService.VALUE_TYPES.POINT && dm.referencedImageId
  );

  const nonAcquisitionMeasurements = displayMeasurements.filter(dm => dm.referencedImageId == null);

  const [modelResult, setModelResult] = useState(null);
  const isObjectEmpty = obj => {
    return Object.keys(obj).length === 0;
  };
  const getModelResult = async () => {
    try {
      const response = await apiClient.getClassificationOutput(studyInstanceUid);
      if (response && response.result) {
        const attachment = response.result.attachment;
        if (typeof attachment === 'object' && isObjectEmpty(attachment)) {
          setModelResult(null);
        } else {
          const arrayFromEntries = Object.entries(
            Object.entries(Object.entries(attachment)[0][1])
          )[0][1];
          // const obj = Object.entries(arrayFromEntries)[0][1];
          const data = Object.entries(arrayFromEntries[1]);
          const predictedDiseases = data[0][1];
          const scores = data[1][1];
          const combinedObject = predictedDiseases.reduce((acc, key, index) => {
            acc[key] = scores[index].toFixed(4);
            return acc;
          }, {});
          setModelResult(combinedObject);
        }
      } else {
        console.log('Model has not been run yet');
        setModelResult(null);
      }
    } catch (error) {
      console.error('Failed to get Classification results', error);
      setModelResult(null);
    }
  };

  useEffect(() => {
    setModelResult(null);
    getModelResult();
  }, []);

  return (
    <div>
      {renderHeader && (
        <>
          <div className="bg-primary-dark flex select-none rounded-t pt-1.5 pb-[2px]">
            <div className="flex h-[24px] w-full cursor-pointer select-none justify-center self-center text-[14px]">
              <div className="text-primary-active flex grow cursor-pointer select-none justify-center self-center text-[13px]">
                <span>{tab.label}</span>
              </div>
            </div>

            {getCloseIcon()}
          </div>
          <Separator
            orientation="horizontal"
            className="bg-black"
            thickness="2px"
          />
        </>
      )}
      <div
        className="invisible-scrollbar overflow-y-auto overflow-x-hidden"
        ref={measurementsPanelRef}
        data-cy={'trackedMeasurements-panel'}
      >
        {displayStudySummary.key && (
          <StudySummary
            date={formatDate(displayStudySummary.date)}
            modality={displayStudySummary.modality}
            description={displayStudySummary.description}
          />
        )}
        <MeasurementTable
          title="Measurements"
          data={displayMeasurementsWithoutFindings}
          servicesManager={servicesManager}
          onClick={jumpToImage}
          onEdit={onMeasurementItemEditHandler}
        />
        {additionalFindings.length !== 0 && (
          <MeasurementTable
            title="Additional Findings"
            data={additionalFindings}
            servicesManager={servicesManager}
            onClick={jumpToImage}
            onEdit={onMeasurementItemEditHandler}
          />
        )}
        {nonAcquisitionMeasurements.length !== 0 && (
          <MeasurementTable
            title="Non-tracked"
            data={nonAcquisitionMeasurements}
            servicesManager={servicesManager}
            onClick={jumpToImage}
            onEdit={onMeasurementItemEditHandler}
          />
        )}
      </div>
      <div className="mx-6 my-4">
        <div>
          <RunModel type={OptionEnum.XRay} />
        </div>
        <h3 className="mb-4 text-xl font-semibold text-white">
          Predicted Diseases v/s Condifdence Score
        </h3>
        <div className="mb-6 flex flex-col space-y-4">
          {modelResult ? (
            <ul className="list-disc pl-5">
              {Object.entries(modelResult).map(([key, value]) => (
                <li
                  key={key}
                  className="text-white"
                >
                  <strong>{key}:</strong> {value}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-red-400">Model not run yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

XRayPanel.propTypes = {
  servicesManager: PropTypes.shape({
    services: PropTypes.shape({
      measurementService: PropTypes.shape({
        getMeasurements: PropTypes.func.isRequired,
        VALUE_TYPES: PropTypes.object.isRequired,
      }).isRequired,
    }).isRequired,
  }).isRequired,
};

function _mapMeasurementToDisplay(measurement, types, displaySetService) {
  const { referenceStudyUID, referenceSeriesUID, SOPInstanceUID } = measurement;

  // TODO: We don't deal with multiframe well yet, would need to update
  // This in OHIF-312 when we add FrameIndex to measurements.

  const instance = DicomMetadataStore.getInstance(
    referenceStudyUID,
    referenceSeriesUID,
    SOPInstanceUID
  );

  const displaySets = displaySetService.getDisplaySetsForSeries(referenceSeriesUID);

  if (!displaySets[0]?.instances) {
    throw new Error('The tracked measurements panel should only be tracking "stack" displaySets.');
  }

  const {
    displayText: baseDisplayText,
    uid,
    label: baseLabel,
    type,
    selected,
    findingSites,
    finding,
    referencedImageId,
  } = measurement;

  const firstSite = findingSites?.[0];
  const label = baseLabel || finding?.text || firstSite?.text || '(empty)';
  let displayText = baseDisplayText || [];
  if (findingSites) {
    const siteText = [];
    findingSites.forEach(site => {
      if (site?.text !== label) {
        siteText.push(site.text);
      }
    });
    displayText = [...siteText, ...displayText];
  }
  if (finding && finding?.text !== label) {
    displayText = [finding.text, ...displayText];
  }

  return {
    uid,
    label,
    baseLabel,
    measurementType: type,
    displayText,
    baseDisplayText,
    isActive: selected,
    finding,
    findingSites,
    referencedImageId,
  };
}

export default XRayPanel;
