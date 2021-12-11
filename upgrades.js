var H5PUpgrades = H5PUpgrades || {};

H5PUpgrades['H5P.ImagePair'] = (function () {
  return {
    1: {
      /**
       * Asynchronous content upgrade hook.
       *
       * Make behavioural group an object.
       *
       * @param {object} parameters Parameters.
       * @param {function} finished Callback.
       * @param {object} extras Extra data.
       */
      5: function (parameters, finished, extras) {
        parameters = parameters || {};
        parameters.behaviour = parameters.behaviour || {};

        let allowRetry = false;
        if (typeof parameters.behaviour === 'boolean') {
          allowRetry = parameters.behaviour;
        }

        parameters.behaviour = {
          allowRetry: allowRetry,
          enforceColumns: false
        };

        finished(null, parameters, extras);
      }
    }
  };
})();
