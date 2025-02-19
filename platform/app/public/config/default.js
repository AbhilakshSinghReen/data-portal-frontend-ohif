// const apiBaseUrl = 'https://aih.cse.iitd.ac.in/api/v1';
const apiBaseUrl = 'http://localhost:8000/api/v1';

const availableMlModels = {
  'LQ Adapter': {
    displayName: 'LQ Adapter',
    type: 'Detection',
    annotationColor: 'rgb(255, 0, 0)',
    detectedObject: 'Gall Bladder',
  },
  focalnet: {
    displayName: 'FocalNet-DINO',
    type: 'Detection',
    annotationColor: 'rgb(0, 255, 0)',
    detectedObject: 'Breast Cancer',
  },
  multiview: {
    displayName: 'Multiview',
    type: 'Detection',
    annotationColor: 'rgb(255, 255, 255)',
    detectedObject: 'Breast Cancer',
  },
  densemass: {
    displayName: 'Densemass',
    type: 'Detection',
    annotationColor: 'rgb(255, 0, 0)',
    detectedObject: 'Breast Cancer',
  },
  smallmass: {
    displayName: 'Smallmass',
    type: 'Detection',
    annotationColor: 'rgb(255, 192, 203)',
    detectedObject: 'Breast Cancer',
  },
};
const availableMlModelsEnumsSet = new Set(Object.keys(availableMlModels));
const availableMlModelsDisplayNamesSet = new Set(
  Object.keys(availableMlModels).map(mlModelEnum => availableMlModels[mlModelEnum].displayName)
);
const mlModelDisplayNameToEnum = Object.keys(availableMlModels).reduce((acc, key) => {
  const displayName = availableMlModels[key].displayName;
  acc[displayName] = key;
  return acc;
}, {});

function processDicomSRAnnotation(annotation) {
  const annotationLabel = annotation.data.labels[0].label;
  let annotationColor = null;

  if (availableMlModelsEnumsSet.has(annotationLabel)) {
    const modelEnum = annotationLabel;

    annotation.data.labels[0].label = availableMlModels[modelEnum].displayName;
    annotation.data.labels[0].value = availableMlModels[modelEnum].detectedObject;
    annotationColor = availableMlModels[modelEnum].annotationColor;
  } else if (availableMlModelsDisplayNamesSet.has(annotationLabel)) {
    const modelEnum = mlModelDisplayNameToEnum[annotationLabel];
    annotationColor = availableMlModels[modelEnum].annotationColor;
  }

  return {
    updatedAnnotation: annotation,
    annotationColor: annotationColor,
  };
}

const customization = {
  processDicomSRAnnotation: processDicomSRAnnotation,
};

window.config = {
  apiBaseUrl: apiBaseUrl,
  customization: customization,

  routerBasename: '/swasth',
  // whiteLabeling: {},
  extensions: [],
  modes: [],
  // customizationService: {},
  customizationService: {
    dicomUploadComponent:
      '@ohif/extension-cornerstone.customizationModule.cornerstoneDicomUploadComponent',
  },
  showStudyList: true,
  // some windows systems have issues with more than 3 web workers
  maxNumberOfWebWorkers: 3,
  // below flag is for performance reasons, but it might not work for all servers
  showWarningMessageForCrossOrigin: false, // TODO: set this to true and fix the warning
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  groupEnabledModesFirst: true,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    // Prefetch number is dependent on the http protocol. For http 2 or
    // above, the number of requests can be go a lot higher.
    prefetch: 25,
  },
  investigationalUseDialog: {
    option: 'never',
  },
  // filterQueryParam: false,
  defaultDataSourceName: 'dicomweb',
  /* Dynamic config allows user to pass "configUrl" query string this allows to load config without recompiling application. The regex will ensure valid configuration source */
  // dangerouslyUseDynamicConfig: {
  //   enabled: true,
  //   // regex will ensure valid configuration source and default is /.*/ which matches any character. To use this, setup your own regex to choose a specific source of configuration only.
  //   // Example 1, to allow numbers and letters in an absolute or sub-path only.
  //   // regex: /(0-9A-Za-z.]+)(\/[0-9A-Za-z.]+)*/
  //   // Example 2, to restricts to either hosptial.com or othersite.com.
  //   // regex: /(https:\/\/hospital.com(\/[0-9A-Za-z.]+)*)|(https:\/\/othersite.com(\/[0-9A-Za-z.]+)*)/
  //   regex: /.*/,
  // },
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'CoE DICOM Web Wrapper',
        name: 'aws',
        wadoUriRoot: 'https://d33do7qe4w26qo.cloudfront.net/dicomweb',
        qidoRoot: `${apiBaseUrl}/dicom-web/qido-rs`,
        wadoRoot: `${apiBaseUrl}/dicom-web/wado-rs`,
        qidoSupportsIncludeField: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,
        dicomUploadEnabled: true,
        staticWado: true,
        singlepart: 'bulkdata,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'series',
        },
        omitQuotationForMultipartRequest: true,
      },
    },
  ],

  // whiteLabeling: {
  //   /* Optional: Should return a React component to be rendered in the "Logo" section of the application's Top Navigation bar */
  //   createLogoComponentFn: function (React) {
  //     return React.createElement(
  //       'a',
  //       {
  //         target: '_self',
  //         rel: 'noopener noreferrer',
  //         className: 'text-purple-600 line-through',
  //         href: '/',
  //       },
  //       React.createElement('img',
  //         {
  //           src: './assets/customLogo.svg',
  //           className: 'w-8 h-8',
  //         }
  //       ))
  //   },
  // },

  hotkeys: [
    {
      commandName: 'incrementActiveViewport',
      label: 'Next Viewport',
      keys: ['right'],
    },
    {
      commandName: 'decrementActiveViewport',
      label: 'Previous Viewport',
      keys: ['left'],
    },
    { commandName: 'rotateViewportCW', label: 'Rotate Right', keys: ['r'] },
    { commandName: 'rotateViewportCCW', label: 'Rotate Left', keys: ['l'] },
    { commandName: 'invertViewport', label: 'Invert', keys: ['i'] },
    {
      commandName: 'flipViewportHorizontal',
      label: 'Flip Horizontally',
      keys: ['h'],
    },
    {
      commandName: 'flipViewportVertical',
      label: 'Flip Vertically',
      keys: ['v'],
    },
    { commandName: 'scaleUpViewport', label: 'Zoom In', keys: ['+'] },
    { commandName: 'scaleDownViewport', label: 'Zoom Out', keys: ['-'] },
    { commandName: 'fitViewportToWindow', label: 'Zoom to Fit', keys: ['='] },
    { commandName: 'resetViewport', label: 'Reset', keys: ['space'] },
    { commandName: 'nextImage', label: 'Next Image', keys: ['down'] },
    { commandName: 'previousImage', label: 'Previous Image', keys: ['up'] },
    // {
    //   commandName: 'previousViewportDisplaySet',
    //   label: 'Previous Series',
    //   keys: ['pagedown'],
    // },
    // {
    //   commandName: 'nextViewportDisplaySet',
    //   label: 'Next Series',
    //   keys: ['pageup'],
    // },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Zoom' },
      label: 'Zoom',
      keys: ['z'],
    },
    // ~ Window level presets
    {
      commandName: 'windowLevelPreset1',
      label: 'W/L Preset 1',
      keys: ['1'],
    },
    {
      commandName: 'windowLevelPreset2',
      label: 'W/L Preset 2',
      keys: ['2'],
    },
    {
      commandName: 'windowLevelPreset3',
      label: 'W/L Preset 3',
      keys: ['3'],
    },
    {
      commandName: 'windowLevelPreset4',
      label: 'W/L Preset 4',
      keys: ['4'],
    },
    {
      commandName: 'windowLevelPreset5',
      label: 'W/L Preset 5',
      keys: ['5'],
    },
    {
      commandName: 'windowLevelPreset6',
      label: 'W/L Preset 6',
      keys: ['6'],
    },
    {
      commandName: 'windowLevelPreset7',
      label: 'W/L Preset 7',
      keys: ['7'],
    },
    {
      commandName: 'windowLevelPreset8',
      label: 'W/L Preset 8',
      keys: ['8'],
    },
    {
      commandName: 'windowLevelPreset9',
      label: 'W/L Preset 9',
      keys: ['9'],
    },
  ],
};

function waitForElement(selector, maxAttempts = 20, interval = 25) {
  return new Promise(resolve => {
    let attempts = 0;

    const checkForElement = setInterval(() => {
      const element = document.querySelector(selector);

      if (element || attempts >= maxAttempts) {
        clearInterval(checkForElement);
        resolve();
      }

      attempts++;
    }, interval);
  });
}
console.log('Config:', window.config);
