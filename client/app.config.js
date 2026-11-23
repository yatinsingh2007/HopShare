// On EAS, google-services.json comes from the GOOGLE_SERVICES_JSON file variable (git never has it);
// locally it's the file in this folder.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile },
});
