/* eslint-disable  react/no-unused-state */
/* eslint-disable  camelcase */

import React from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';
import dayjs from 'dayjs';
import BlockchainInfoContext from './BlockchainInfoContext';
import * as Brain from '../apis/brain';
import {
  debug,
  MYBIT_TICKER_COINMARKETCAP,
  ETHEREUM_TICKER_COINMARKETCAP,
  serverIp,
  ethereumNetwork,
  fetchTransactionHistoryTime,
  loadMetamaskUserDetailsTime,
  pullAssetsFromServerTime,
  fetchAssetsFromWeb3Time,
  S3_URL,
  AIRTABLE_CATEGORIES_URL,
  AIRTABLE_ASSETS_URL,
  AIRTABLE_CATEGORIES_NUMBER_OF_FIELDS,
  AIRTABLE_ASSETS_NUMBER_OF_FIELDS,
  S3_ASSET_FILES_URL,
} from '../constants';

import {
  NotificationTypes,
  NotificationsMetamask,
  NotificationStatus,
} from '../constants/notifications';

import ErrorTypes from '../constants/errorTypes';

class BlockchainInfo extends React.Component {
  constructor(props) {
    super(props);
    this.fetchAssets = this.fetchAssets.bind(this);
    this.loadMetamaskUserDetails = this.loadMetamaskUserDetails.bind(this);
    this.fetchTransactionHistory = this.fetchTransactionHistory.bind(this);
    this.loadPrices = this.loadPrices.bind(this);
    this.getMYB = this.getMYB.bind(this);
    this.fundAsset = this.fundAsset.bind(this);
    this.pullAssetsFromServer = this.pullAssetsFromServer.bind(this);
    this.handleAddressChange = this.handleAddressChange.bind(this);
    this.handleAssetFavorited = this.handleAssetFavorited.bind(this);
    this.usingServer = this.usingServer.bind(this);
    this.getAssetsFromAirTable = this.getAssetsFromAirTable.bind(this);
    this.getCategoriesForAssets = this.getCategoriesForAssets.bind(this);
    this.handleListAsset = this.handleListAsset.bind(this);
    this.getAssetFromAirTableByName = this.getAssetFromAirTableByName.bind(this);
    this.removeNotification = this.removeNotification.bind(this);
    this.updateNotification = this.updateNotification.bind(this);
    this.getCategoriesFromAirTable = this.getCategoriesFromAirTable.bind(this);
    this.withdrawInvestorProfit = this.withdrawInvestorProfit.bind(this);
    this.withdrawCollateral = this.withdrawCollateral.bind(this);
    this.resetNotifications = this.resetNotifications.bind(this);
    this.withdrawProfitAssetManager = this.withdrawProfitAssetManager.bind(this);

    this.state = {
      loading: {
        assets: true,
        priceMybit: true,
        priceEther: true,
        user: true,
        transactionHistory: true,
      },
      transactions: [],
      assets: [],
      prices: {},
      fetchAssets: this.fetchAssets,
      fetchTransactionHistory: this.fetchTransactionHistory,
      fetchMyBit: this.getMYB,
      fundAsset: this.fundAsset,
      user: this.props.user || {},
      userHasMetamask: this.props.isMetamaskInstalled,
      network: this.props.network,
      isBraveBrowser: this.props.isBraveBrowser,
      extensionUrl: this.props.extensionUrl,
      enabled: this.props.enabled,
      userIsLoggedIn: this.props.isLoggedIn,
      handleClickedAssetFavorite: this.handleAssetFavorited,
      getCategoriesForAssets: this.getCategoriesForAssets,
      handleListAsset: this.handleListAsset,
      removeNotification: this.removeNotification,
      updateNotification: this.updateNotification,
      withdrawInvestorProfit: this.withdrawInvestorProfit,
      withdrawCollateral: this.withdrawCollateral,
      withdrawProfitAssetManager: this.withdrawProfitAssetManager,
      notifications: {},
      isUserContributing: false,
      withdrawingAssetIds: [],
      withdrawingCollateral: [],
      withdrawingAssetManager: [],
    };
  }

  async componentDidMount() {
    // TODO perhaps we don't need to wait for these here
    await Promise.all([this.getAssetsFromAirTable(), this.getCategoriesFromAirTable()]);
    try {
      const usingServer = this.usingServer();
      if (!usingServer) {
        // we need the prices and the user details before getting the assets and transactions
        await Promise.all([this.loadMetamaskUserDetails(), this.loadPrices()]);
        await Promise.all([this.fetchAssets(), this.fetchTransactionHistory()]);
        this.createIntervalsNonServer();
      } else {
        await this.loadPrices();
        this.pullAssetsFromServer();
        this.intervalAssetsFromServer =
          setInterval(this.pullAssetsFromServer, pullAssetsFromServerTime);
      }
    } catch (err) {
      debug(err);
    }
    setInterval(this.loadPrices, 15 * 1000);
  }

  componentWillReceiveProps(nextProps){
    const currentAddress = this.state.user ? this.state.user.userName : undefined;
    const loggedIn = this.state.userIsLoggedIn;
    const enabled = this.state.enabled;
    // case where account changes
    if((nextProps.user.userName && (this.state.user.userName !== nextProps.user.userName)) || (this.state.userIsLoggedIn !== nextProps.isLoggedIn && (this.props.network === ethereumNetwork)) || (enabled !== nextProps.enabled)){
      this.setState({
        user: nextProps.user,
        userIsLoggedIn: nextProps.isLoggedIn,
        enabled: nextProps.enabled
      }, () => this.handleAddressChange(currentAddress, loggedIn, enabled));
    }
    if(nextProps.user.balance && (this.state.user.balance !== nextProps.user.balance)){
      this.setState({
        user: {
          ...this.state.user,
          balance: nextProps.user.balance,
        },
      })
    }
    //case where user enables us to access accounts
    if(!this.state.enabled && nextProps.enabled){
      this.setState({
        enabled: true,
      });
    }
  }

  componentWillUnmount() {
    this.resetIntervals();
  }

  createIntervalsNonServer(){
    this.intervalFetchAssets =
      setInterval(this.fetchAssets, fetchAssetsFromWeb3Time);
    this.intervalFetchTransactionHistory =
      setInterval(this.fetchTransactionHistory, fetchTransactionHistoryTime);
    this.intervalLoadMetamaskUserDetails =
      setInterval(this.loadMetamaskUserDetails, loadMetamaskUserDetailsTime);
  }

  resetIntervals(){
    clearInterval(this.intervalAssetsFromServer);
    clearInterval(this.intervalFetchAssets);
    clearInterval(this.intervalAssetsFromServer);
    clearInterval(this.intervalFetchTransactionHistory);
    clearInterval(this.intervalLoadMetamaskUserDetails);
  }

  async pullFileInfoForAssets(assets){
    try{
      const response = await axios(S3_ASSET_FILES_URL);

      const filesByAssetId = response.data.filesByAssetId;

      for(const asset of assets){
        const assetId = asset.assetID;
        if(filesByAssetId[assetId]){
          asset.files = filesByAssetId[assetId];
        }
      }
      return assets;
    }catch(err){
      debug("Error pulling files from server");
      debug(err)
      return assets;
    }
  }

  async withdrawProfitAssetManager(asset, amount, updateAssetCollateralPage){
    const {
      assetID,
      name: assetName,
    } = asset;

    const notificationId = Date.now();

    //update state so users can't trigger the withdrawal multiple times
    const withdrawingAssetManager = this.state.withdrawingAssetManager.slice();
    withdrawingAssetManager.push(assetID);
    this.setState({
      withdrawingAssetManager,
    });

    this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.INFO, {
      operationType: NotificationsMetamask.WITHDRAW_MANAGER,
      assetName,
    });

    const onTransactionHash = () => {
      this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_MANAGER, NotificationStatus.INFO, {
        assetName,
      });
    }

    const onReceipt = (wasSuccessful) => {
      if(wasSuccessful){
        onSuccess();
      } else{
        onError(ErrorTypes.ETHEREUM);
      }
    }

    const onError = (type) => {
      updatewithdrawingAssetManager();
      if(type === ErrorTypes.METAMASK){
        this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.ERROR, {
          operationType: NotificationsMetamask.WITHDRAW_MANAGER,
          assetName,
        });
      } else {
        this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_MANAGER, NotificationStatus.ERROR, {
          assetName,
        });
      }
    }

    const updatewithdrawingAssetManager = () => {
      let withdrawingAssetManager = this.state.withdrawingAssetManager.slice();
      withdrawingAssetManager = withdrawingAssetManager.filter(assetIdTmp => assetIdTmp !== assetID);
      this.setState({
        withdrawingAssetManager,
      });
    }

    const onSuccess = () => {
      updateAssetCollateralPage(() => {
        updatewithdrawingAssetManager();
        this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_MANAGER, NotificationStatus.SUCCESS, {
          assetName,
          amount,
        });
      })
    }

    await Brain.withdrawAssetManager(
      this.state.user.userName,
      assetID,
      onTransactionHash,
      onReceipt,
      onError,
    );
  }

  async withdrawCollateral(asset, percentage, amount, updateAssetCollateralPage){
    const {
      assetID,
      name: assetName,
    } = asset;
    const notificationId = Date.now();

    //update state so users can't trigger the withdrawal multiple times
    const withdrawingCollateral = this.state.withdrawingCollateral.slice();
    withdrawingCollateral.push(assetID);
    this.setState({
      withdrawingCollateral,
    });

    this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.INFO, {
      operationType: NotificationsMetamask.WITHDRAW_COLLATERAL,
      assetName,
    });

    const onTransactionHash = () => {
      this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_COLLATERAL, NotificationStatus.INFO, {
        assetName,
      });
    }

    const onReceipt = (wasSuccessful) => {
      if(wasSuccessful){
        onSuccess();
      } else{
        onError(ErrorTypes.ETHEREUM);
      }
    }

    const onError = (type) => {
      updateWithdrawingCollateral();
      if(type === ErrorTypes.METAMASK){
        this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.ERROR, {
          operationType: NotificationsMetamask.WITHDRAW_COLLATERAL,
          assetName,
        });
      } else {
        this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_COLLATERAL, NotificationStatus.ERROR, {
          assetName,
        });
      }
    }

    const updateWithdrawingCollateral = () => {
      let withdrawingCollateral = this.state.withdrawingCollateral.slice();
      withdrawingCollateral = withdrawingCollateral.filter(assetIdTmp => assetIdTmp !== assetID);
      this.setState({
        withdrawingCollateral,
      });
    }

    const onSuccess = () => {
      updateAssetCollateralPage(() => {
        updateWithdrawingCollateral();
        this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_COLLATERAL, NotificationStatus.SUCCESS, {
          assetName,
          percentage,
          amount,
        });
      })
    }

    await Brain.withdrawEscrow(
      this.state.user.userName,
      assetID,
      onTransactionHash,
      onReceipt,
      onError,
    );

  }

  async handleListAsset(formData, setUserListingAsset){
    const {
      asset: assetName,
      userCountry: country,
      userCity: city,
      managementFee,
      category,
      fileList,
      collateralMyb,
      collateralPercentage
    } = formData;

    const {
      categoriesAirTable,
    } = this.state;

    const userAddress =  this.state.user.userName;
    const notificationId = Date.now();

    this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.INFO, {
      operationType: NotificationsMetamask.LIST_ASSET,
      assetName,
    });

    const onTransactionHash = () => {
      this.buildAndUpdateNotification(notificationId, NotificationTypes.LIST_ASSET, NotificationStatus.INFO, {
        assetName,
      });
    }

    const onReceipt = (wasSuccessful, assetId) => {
      if(wasSuccessful){
        onSuccess(assetId);
      } else{
        onError(ErrorTypes.ETHEREUM);
      }
    }

    const onSuccess = async (assetId) => {
      const numberOfInternalActions = 2;
      const numberOfInternalActionsWithFileUpload = numberOfInternalActions + 1;
      const filesUploaded = fileList.length > 0;
      const requiredCallsToInternalActions = filesUploaded ? numberOfInternalActionsWithFileUpload : numberOfInternalActions;
      let counterCallsToInternalActions = 0;

      // we need to perform a few actions before declaring the listing of the asset as successful
      const performInternalAction = async () => {
        counterCallsToInternalActions++;
        if(counterCallsToInternalActions === requiredCallsToInternalActions){
          await this.getAssetsFromAirTable();
          await this.fetchAssets();

          this.buildAndUpdateNotification(notificationId, NotificationTypes.LIST_ASSET, NotificationStatus.SUCCESS, {
            assetName,
            assetId,
          });
          setUserListingAsset(false, assetId);
        }
      }

      const collateral = window.web3js.utils.toWei(collateralMyb.toString(), 'ether');

      Brain.updateAirTableWithNewAsset(assetId, assetName, country, city, collateralMyb, collateralPercentage, performInternalAction)
      Brain.createEntryForNewCollateral(userAddress, collateral, assetId, performInternalAction);
      filesUploaded && Brain.uploadFilesToAWS(assetId, fileList, performInternalAction);
    }

    const onError = (type) => {
      setUserListingAsset(false);
      if(type === ErrorTypes.METAMASK){
        this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.ERROR, {
          assetName,
          operationType: NotificationsMetamask.LIST_ASSET,
        });
      } else {
        this.buildAndUpdateNotification(notificationId, NotificationTypes.LIST_ASSET, NotificationStatus.ERROR, {
          assetName,
        });
      }
    }

    await Brain.createAsset(onTransactionHash, onReceipt, onError, {
      managerPercentage: managementFee,
      assetType: categoriesAirTable[category].encoded,
      amountToBeRaisedInUSD: this.getAssetFromAirTableByName(assetName).amountToBeRaisedInUSDAirtable,
      assetName,
      country,
      city,
      fileList,
      collateralMyb,
      collateralPercentage,
      userAddress,
    });
  }


  fundAsset(assetId, amount, onSuccessConfirmationPopup, onFailureContributionPopup, amountDollars) {
    try {
      const currentAsset = this.state.assets.find(item => item.assetID === assetId);
      const notificationId = Date.now();
      const {
        name : assetName,
      } = currentAsset;

      this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.INFO, {
        operationType: NotificationsMetamask.FUNDING,
        assetName,
      });

      const onTransactionHash = () => {
        this.buildAndUpdateNotification(notificationId, NotificationTypes.FUNDING, NotificationStatus.INFO, {
          assetName,
          amount: amountDollars,
        });
      }

      const onReceipt = (wasSuccessful) => {
        if(wasSuccessful){
          onSuccessRefreshData();
        } else {
          onError(ErrorTypes.ETHEREUM)
        }
      }

      const onError = (type) => {
        onFailureContributionPopup();
        if(type === ErrorTypes.METAMASK){
          this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.ERROR, {
            operationType: NotificationsMetamask.FUNDING,
          });
        } else {
          this.buildAndUpdateNotification(notificationId, NotificationTypes.FUNDING, NotificationStatus.ERROR, {
            assetName,
          });
        }
      }

      const onSuccessRefreshData = async () => {
        await Promise.all([this.fetchAssets(), this.fetchTransactionHistory()]);
        onSuccessConfirmationPopup();
        this.buildAndUpdateNotification(notificationId, NotificationTypes.FUNDING, NotificationStatus.SUCCESS, {
          assetName,
          amount: amountDollars,
        });
      }

      Brain.fundAsset(
        this.state.user.userName,
        assetId,
        amount,
        onTransactionHash,
        onReceipt,
        onError,
      );

    } catch (err) {
      debug(err);
    }
  }

  async withdrawInvestorProfit(assetId, amount) {
    try {
      const currentAsset = this.state.assets.find(item => item.assetID === assetId);
      const{
        name: assetName,
      } = currentAsset;
      const notificationId = Date.now();

      // save the the assetID so the user doesn't trigger twice while we
      // perform the action
      const withdrawingAssetIds = this.state.withdrawingAssetIds.slice();
      withdrawingAssetIds.push(assetId);
      this.setState({
        withdrawingAssetIds,
      })

      this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.INFO, {
        operationType: NotificationsMetamask.WITHDRAW_INVESTOR,
        assetName,
      });

      const onTransactionHash = () => {
        this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_INVESTOR, NotificationStatus.INFO, {
          assetName,
          amount,
        });
      }

      const onReceipt = (wasSuccessful) => {
        if(wasSuccessful){
          onSuccessRefreshData();
        } else {
          onError(ErrorTypes.ETHEREUM);
        }
      }

      const onError = (type) => {
        removeAssetIdFromList();
        if(type === ErrorTypes.METAMASK){
          this.buildAndUpdateNotification(notificationId, NotificationTypes.METAMASK, NotificationStatus.ERROR, {
            operationType: NotificationsMetamask.WITHDRAW_INVESTOR,
          });
        } else {
          this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_INVESTOR, NotificationStatus.ERROR, {
            assetName,
          });
        }
      }

      const removeAssetIdFromList = () => {
        let withdrawingAssetIds = this.state.withdrawingAssetIds.slice();
        withdrawingAssetIds = withdrawingAssetIds.filter(assetIdTmp => assetIdTmp !== assetId);
        this.setState({
          withdrawingAssetIds,
        })
      }

      const onSuccessRefreshData = async () => {
        await Promise.all([this.fetchAssets(), this.fetchTransactionHistory()]);
        removeAssetIdFromList();
        this.buildAndUpdateNotification(notificationId, NotificationTypes.WITHDRAW_INVESTOR, NotificationStatus.SUCCESS, {
          assetName,
          amount,
        });
      }

      await Brain.withdrawInvestorProfit(
        this.state.user.userName,
        currentAsset.assetID,
        onTransactionHash,
        onReceipt,
        onError,
      );

    } catch (err) {
      debug(err);
    }
  }


  updateNotification(id, data){
    const notifications = Object.assign({}, this.state.notifications);
    notifications[id] = data;
    this.setState({notifications});
  }


  removeNotification(id){
    const notifications = Object.assign({}, this.state.notifications);
    delete notifications[id];
    this.setState({notifications});
  }

  processAssetsFromAirTable({ fields }){
    let location = undefined;
    if(fields.Location){
      let countries = fields.Location.split(',');
      location = {};
      countries.forEach(country => {
        country = country.trim();
        let cities = /\(([^)]+)\)/g.exec(country);

        if(cities){
          country = country.substring(0, country.indexOf('('))
          cities = cities[1].split(';');
          location[country] = cities;
        } else {
           location[country] = {};
        }
      })
    }
    return {
      name: fields.Asset,
      category: fields.Category,
      description: fields.Description,
      details: fields.Details,
      partner: fields.Partner,
      imageSrc: `${S3_URL}assetImages:${fields['Image']}`,
      amountToBeRaisedInUSDAirtable: fields['Funding goal'],
      location,
    };
  }

  processCategoriesFromAirTable(data){
    const categories = {};
    data.forEach(({ fields }) => {
      categories[fields.Category] = {
        contractName: fields['Category Contract'],
        encoded: fields['byte32'],
      }
    })
    return categories;
  }

  getAssetFromAirTableByName(assetName, assetsFromAirTable){
    assetsFromAirTable = assetsFromAirTable || this.state.assetsAirTable;
    const tmpAsset = Object.assign({}, assetsFromAirTable.filter(asset => asset.name === assetName)[0]);
    tmpAsset.location = undefined;
    return tmpAsset;
  }

  processAssetsByIdFromAirTable(assetsToProcess, assetsFromAirTable){
    const assetsAirTableById = {};
    const tmpCache = {};
    assetsToProcess.forEach(({ fields }) => {
      let assetIds = fields['Asset IDs'];
      if(assetIds){
        const assetName = fields['Asset'];
        const airtableAsset = tmpCache[assetName] || this.getAssetFromAirTableByName(assetName, assetsFromAirTable);
        // add to temporary cache (will help when we have a lot of assets)
        if(airtableAsset && !tmpCache[assetName]){
          tmpCache[assetName] = airtableAsset;
        }
        assetIds = assetIds.split(',');
        assetIds.forEach(assetIdInfo => {
          const [assetId, city, country, collateral, collateralPercentage] = assetIdInfo.split('|');
          airtableAsset.city = city;
          airtableAsset.country = country;
          airtableAsset.collateral = Number(collateral);
          airtableAsset.collateralPercentage = collateralPercentage;
          assetsAirTableById[assetId] = airtableAsset;
        })
      }
    })
    return assetsAirTableById;
  }

  async getAssetsFromAirTable(){
    try{
      const request = await fetch(AIRTABLE_ASSETS_URL);
      const json = await request.json();
      const { records } = json;
      const assets = records.filter(({ fields })  => Object.keys(fields).length >= AIRTABLE_ASSETS_NUMBER_OF_FIELDS).map(this.processAssetsFromAirTable)
      const assetsById = this.processAssetsByIdFromAirTable(records.filter(({ fields })  => Object.keys(fields).length >= AIRTABLE_ASSETS_NUMBER_OF_FIELDS), assets);
      this.setState({
        assetsAirTable: assets,
        assetsAirTableById: assetsById,
      });
    }catch(err){
      setTimeout(this.getAssetsFromAirTable, 5000);
      debug(err);
    }
  }

  async getCategoriesFromAirTable(){
    try{
      const request = await fetch(AIRTABLE_CATEGORIES_URL);
      const json = await request.json();
      const { records } = json;
      const categories = this.processCategoriesFromAirTable(records.filter(({ fields })  => Object.keys(fields).length === AIRTABLE_CATEGORIES_NUMBER_OF_FIELDS));
      this.setState({
        categoriesAirTable: categories,
      })
    }catch(err){
      setTimeout(this.getCategoriesFromAirTable, 5000);
      debug(err);
    }
  }

  getCategoriesForAssets(country, city){
    const {
      assetsAirTable,
      categoriesAirTable,
    } = this.state;
    let categories = [];
    for(const asset of assetsAirTable){
      if(categories.includes(asset.category)){
        continue;
      }
      if(!asset.location){
        categories.push(categoriesAirTable[asset.category] ? asset.category : undefined);
      } else if (asset.location && asset.location.country === country && (!asset.location.cities || asset.location.cities.includes(city.toLowerCase()))){
        categories.push(categoriesAirTable[asset.category] ? asset.category : undefined);
      }
    }
    return categories;
  }

  getMYB() {
    return Brain.withdrawFromFaucet(this.state.user);
  }

  usingServer() {
    const { userHasMetamask, userIsLoggedIn, network, enabled } = this.state;
    return !userHasMetamask || !userIsLoggedIn || network !== ethereumNetwork || !enabled;
  }

  handleAssetFavorited(assetId) {
    const searchQuery = `mybit_watchlist_${assetId}`;
    const alreadyFavorite = window.localStorage.getItem(searchQuery) === 'true';
    if (alreadyFavorite) {
      localStorage.removeItem(searchQuery);
    } else {
      localStorage.setItem(searchQuery, true);
    }

    const assets = this.state.assets.slice();
    const asset = assets.filter(assetToFilter => assetToFilter.assetID === assetId)[0];

    asset.watchListed = !alreadyFavorite;

    this.setState({
      assets,
    });
  }

  async pullAssetsFromServer() {
    const { data } = await axios(serverIp);
    if (!data.assetsLoaded) {
      return;
    }

    let assetsToReturn = data.assets.map((asset) => {
      let watchListed = false;

      if (!this.usingServer()) {
        const searchQuery = `mybit_watchlist_${asset.assetID}`;
        watchListed = window.localStorage.getItem(searchQuery) || false;
      }

      let details = this.state.assetsAirTableById[asset.assetID];
      // if the asset Id is not on airtable it doens't show up in the platform
      if (!details) {
        return undefined;
      }

      return {
        ...details,
        ...asset,
        fundingDeadline: dayjs(Number(asset.fundingDeadline) * 1000),
        watchListed,
      };
    });

    if (process.env.NODE_ENV !== 'development') {
      // filter for test assets. Only for development
      assetsToReturn = assetsToReturn.filter(asset =>
        asset && asset.description !== 'Coming soon');
    } else {
      // returns all assets that were matched to the assets
      // in Airtable
      assetsToReturn = assetsToReturn.filter(asset =>
        asset !== undefined);
    }

    const updatedAssets = await this.pullFileInfoForAssets(assetsToReturn);

    this.setState({
      usingServer: true,
      assets: updatedAssets,
      transactions: [],
      loading: {
        ...this.state.loading,
        assets: false,
        transactionHistory: false,
      },
    });
  }

  resetNotifications(){
    this.setState({
      notifications: [],
    });
  }

  async handleAddressChange(previousAddress, previouslyLoggedIn, previouslyEnabled) {
    let shouldReloadUI = false;
    const selectedAddress = this.state.user.userName;
    const {
      userIsLoggedIn,
      enabled,
    } = this.state;

    // case where user was not logged in but logged in and opposite case
    if ((!previouslyLoggedIn && userIsLoggedIn && enabled) || (!previouslyEnabled && enabled) || (previousAddress !== selectedAddress && enabled)) {
      shouldReloadUI = true;
      this.loadMetamaskUserDetails();
      this.fetchAssets();
      this.fetchTransactionHistory();
      this.resetIntervals();
      this.createIntervalsNonServer();
      this.resetNotifications();
    } else if ((previouslyLoggedIn && !userIsLoggedIn) || ( previousAddress && !selectedAddress) || (previouslyEnabled !== enabled)) {
      shouldReloadUI = true;
      this.pullAssetsFromServer();
      this.resetNotifications();
      this.resetIntervals();
      this.intervalAssetsFromServer =
        setInterval(this.pullAssetsFromServer, pullAssetsFromServerTime);
    }

    if (shouldReloadUI) {
      this.setState({
        assets: [],
        loading: {
          ...this.state.loading,
          assets: true,
          transactionHistory: true,
        },
      });
    }
  }

  buildAndUpdateNotification(notificationId, type, status, params){
    this.updateNotification(notificationId, {
      [type]: {
        ...params,
      },
      status,
    });
  }

  async loadMetamaskUserDetails() {
    await Brain.loadMetamaskUserDetails()
      .then((response) => {
        this.setState({
          user: response,
          loading: { ...this.state.loading, user: false },
        });
      })
      .catch((err) => {
        debug(err);
        if (this.state.userIsLoggedIn) {
          setTimeout(this.loadMetamaskUserDetails, 5000);
        }
      });
  }

  async fetchTransactionHistory() {
    await Brain.fetchTransactionHistory(this.state.user)
      .then((response) => {
        this.setState({
          transactions: response,
          loading: { ...this.state.loading, transactionHistory: false },
        });
      })
      .catch((err) => {
        debug(err);
        if (this.state.userIsLoggedIn) {
          setTimeout(this.fetchTransactionHistory, 5000);
        }
      });
  }

  async fetchAssets(assetId) {
    const {
      assetsAirTableById,
      prices,
      categoriesAirTable,
      user,
    } = this.state;
    if (!prices.ether || !assetsAirTableById || !categoriesAirTable) {
      setTimeout(this.fetchAssets, 10000);
      return;
    }
    await Brain.fetchAssets(user, prices.ether.price, assetsAirTableById, categoriesAirTable)
      .then( async (response) => {
        const updatedAssets = await this.pullFileInfoForAssets(response);
        this.setState({
          assets: updatedAssets,
          loading: { ...this.state.loading, assets: false },
        });
      })
      .catch((err) => {
        debug(err);
        if (this.state.userIsLoggedIn) {
          setTimeout(this.fetchAssets, 5000);
        }
      });
  }

  async loadPrices() {
    let error = false;
    await Brain.fetchPriceFromCoinmarketcap(MYBIT_TICKER_COINMARKETCAP)
      .then((priceInfo) => {
        this.setState({
          prices: {
            ...this.state.prices,
            mybit: {
              price: priceInfo.price,
              priceChangePercentage: priceInfo.priceChangePercentage,
            },
          },
          loading: {
            ...this.state.loading,
            priceMybit: false,
          },
        });
      })
      .catch((err) => {
        debug(err);
        error = true;
      });
    await Brain.fetchPriceFromCoinmarketcap(ETHEREUM_TICKER_COINMARKETCAP)
      .then((priceInfo) => {
        this.setState({
          prices: {
            ...this.state.prices,
            ether: {
              price: priceInfo.price,
              priceChangePercentage: priceInfo.priceChangePercentage,
            },
          },
          loading: {
            ...this.state.loading,
            priceEther: false,
          },
        });
      })
      .catch((err) => {
        debug(err);
        error = true;
      });
    if (error) {
      setTimeout(this.loadPrices, 5000);
    }
  }

  render() {
    return (
      <BlockchainInfoContext.Provider value={this.state}>
        {this.props.children}
      </BlockchainInfoContext.Provider>
    );
  }
}

BlockchainInfo.defaultProps = {
  isBraveBrowser: false,
  userIsLoggedIn: false,
  network: undefined,
  isMetamaskInstalled: false,
  extensionUrl: undefined,
};

BlockchainInfo.propTypes = {
  children: PropTypes.node.isRequired,
  isMetamaskInstalled: PropTypes.bool,
  network: PropTypes.string,
  isBraveBrowser: PropTypes.bool,
  extensionUrl: PropTypes.string,
  userIsLoggedIn: PropTypes.bool,
};

export default BlockchainInfo;
