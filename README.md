# adtraction.com API Integration

## Installation

To use the library, install it through [npm](https://npmjs.com)

```shell
npm install --save adtraction-webmaster-api
```

## Get API token here
* https://platform.adtraction.com/settings/api


## Usage
    const AdtractionApi = require('adtraction-webmaster-api');
    const api = new AdtractionApi(token);
    let offers = await api.getOffersData(['ES', 'FR']);

## API
* getOffersData(array countryCodes, int offerId?, int channelId?): Object
* getOffersDataByCountryCode(string countryCode, int offerId?, int channelId?): Object
* getLeadsByOfferId(timestamp dateFrom, timestamp dateTo, int offerId?, int channelId?): Object
* getStatisticsOffers(timestamp dateFrom, timestamp dateTo, int offerId?, string subId?): Object
* getOfferLinkByOfferId(int offerId, int channelId, array countryCodes): Object
* apiRequest(method, params) - native adtraction api request
