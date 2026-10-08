const {sleep} = require('usleep');
const API_URL = 'https://api.adtraction.net/';
const STATUS_REJECTED = 'rejected';
const STATUS_OPEN = 'open';
const STATUS_HOLD = 'hold';
const STATUS_APPROVED = 'approved';

class AdtractionApi {

  constructor(token) {
    this.token = token;
  }

  async getOffersData(countryCodes, offerId, channelId) {
    let result = {ok: true, result: []};
    if (!countryCodes.length) {
      return {ok: false, errorMessage: 'countryCodes are mandatory'};
    }
    for (let countryCode of countryCodes) {
      let apiData = await this.getOffersDataByCountryCode(countryCode, offerId, channelId);
      if (!apiData.ok) {
        if (apiData.errorMessage === 'No programs found.') {
          continue;
        } else {
          return apiData;
        }
      }
      result.result = result.result.concat(apiData.result);
    }
    return result;
  }

  async getOffersDataByCountryCode(countryCode, offerId, channelId) {
    let method = 'v3/partner/programs';
    let params = new Map();
    params.set('market', countryCode);
    if (offerId) {
      params.set('programId', offerId);
    }
    if (channelId) {
      params.set('channelId', channelId);
    }
    return await this.apiRequest(method, params);
  }

  async getLeadsByOfferId(dateFrom, dateTo, offerId = null, channelId = null) {
    let method = 'v2/partner/transactions';
    dateFrom = this.#formatDate(dateFrom);
    dateTo = this.#formatDate(dateTo);
    let params = new Map();
    params.set('fromDate', dateFrom);
    params.set('toDate', dateTo);
    params.set('transactionStatus', 0);
    if (offerId) {
      params.set('programId', offerId);
    }
    if (channelId) {
      params.set('channelId', channelId);
    }

    let apiData = await this.apiRequest(method, params);
    if (!apiData.ok) {
      return apiData;
    }
    if (apiData && Array.isArray(apiData.result)) {
      apiData.result.map(it => {
        it.orderId = it.uniqueId;
        it.offerId = it.click.programId;
        it.offerName = it.click.programName;
        it.currency = it.currency;
        it.status = this.#getLeadStatus(it.transactionStatus);
        it.commission = it.commission;
        it.subaccount = it.click.epi;
        it.subaccount2 = it.click.epi2;
        it.subaccount3 = it.click.epi3;
        it.subaccount4 = it.click.epi4;
        it.subaccount5 = it.click.epi5;
        it.leadTime = new Date(it.transactionDate).valueOf();
      });
    }
    return apiData;
  }

  /**
   * short grouped statistics combined for all regions
   * @return {ok: boolean, result: Array {offerId,clicks,leadsOpen,commissionOpen,...}}
   */
  async getStatisticsOffers(dateFrom, dateTo, offerId = null, subid = null) {
    let method = 'v2/partner/transactions';
    dateFrom = this.#formatDate(dateFrom);
    dateTo = this.#formatDate(dateTo);
    let params = new Map();
    params.set('fromDate', dateFrom);
    params.set('toDate', dateTo);
    params.set('transactionStatus', 0);
    if (offerId) {
      params.set('programId', offerId);
    }
    if (subid) {
      params.set('epi', subid);
    }
    let result = new Map();
    let defaultResultItem = {
      offerId: 0,
      offerName: '',
      currency: '',
      clicks: 0,
      leads: 0,
      leadsRejected: 0,
      leadsOpen: 0,
      leadsApproved: 0,
      commissionRejected: 0,
      commissionOpen: 0,
      commissionApproved: 0,
      cr: 0
    }
    let apiData = await this.apiRequest(method, params);
    if (!apiData.ok) {
      if (offerId && apiData.errorMessage === 'No transactions found.') {
        return {ok: true, result: [{...defaultResultItem, offerId: offerId}]};
      }
      return apiData;
    }
    if (apiData && Array.isArray(apiData.result)) {
      for (let it of apiData.result) {
        let resultItem = result.get(it.click.programId) ?? {...defaultResultItem};
        resultItem.currency = it.currency;
        resultItem.offerId = it.click.programId;
        resultItem.offerName = it.click.programName;
        resultItem.leads++;
        if (it.transactionStatus === 1) {
          resultItem.leadsApproved++;
          resultItem.commissionApproved += it.commission;
        }
        if (it.transactionStatus === 2) {
          resultItem.leadsOpen++;
          resultItem.commissionOpen += it.commission;
        }
        if (it.transactionStatus === 5) {
          resultItem.leadsRejected++;
          resultItem.commissionRejected += it.commission;
        }
        result.set(it.click.programId, resultItem);
      }
    }
    result = [...result.values()];
    for (let item of result) {
      item.ar = item.leads ? Math.round(item.leadsApproved / item.leads * 10000) / 100 : 0
    }
    return {ok: true, result};
  }

  async getOfferLinkByOfferId(offerId, channelId, countryCodes) {
    let result = await this.getOffersData(countryCodes, offerId, channelId);
    if (result.ok && result.result[0]?.trackingURL) {
      return {ok: true, result: result.result[0]?.trackingURL};
    } else {
      return {ok: false, errorMessage: result.errorMessage || 'error'};
    }
  }

  #formatDate(timestamp) {
    let mm = new Date(timestamp).getMonth() + 1;
    let dd = new Date(timestamp).getDate();
    return [new Date(timestamp).getFullYear(), (mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd].join('-');
  }

  #getLeadStatus(status) {
    switch (status) {
      case 5:
        return STATUS_REJECTED;
      case 4:
        return STATUS_HOLD;
      case 2:
        return STATUS_OPEN;
      case 1:
        return STATUS_APPROVED;
      default:
        return status;
    }
  }

  async apiRequest(method, params) {
    let result;
    try {
      // console.info('AdtractionApiRequest', method, params);
      result = await (await fetch(API_URL + method, {method: 'POST', headers: {'content-type': 'application/json', 'x-token': this.token}, body: JSON.stringify(Object.fromEntries(params))})).json();
    } catch (e) {
      console.error('adtraction api error', e);
    }
    // console.info('AdtractionApiResponse', new Date().toLocaleString(), result);
    if (!result || result.message || result.error) {
      if (result?.status === 429) {
        const resetTime = result.message.match(/Reset time\s+(\d+)/)?.[1];
        await sleep(Math.ceil((resetTime - Date.now()) / 1000));
        return this.apiRequest(method, params);
      }
      console.error('adtraction api error: ', result);
      return {ok: false, errorMessage: result?.message || result?.error};
    }
    return {ok: true, result: result};
  }

}

module.exports = AdtractionApi;
