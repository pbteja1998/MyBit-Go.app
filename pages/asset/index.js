import Router from 'next/router';
import PropTypes from 'prop-types';
import { compose } from 'recompose'
import AssetDetails from 'components/AssetDetails';
import { withThreeBoxContext } from 'components/ThreeBoxContext';
import { withBlockchainContextPageWrapper } from 'components/BlockchainContext'
import { withMetamaskContextPageWrapper } from 'components/MetamaskContext';
import GoBackTextAndArrow from 'components/GoBackTextAndArrow';
import Loading from 'components/Loading';
import ErrorPage from 'components/ErrorPage';

class AssetPage extends React.Component {
  static async getInitialProps (ctx) {
    return {assetId: ctx.query.id};
  }
  render(){
    const {
      blockchainContext,
      threeBoxContext,
      router,
      metamaskContext,
    } = this.props;

    const {
      assets,
      assetManagers,
      loading,
      handleAssetFavorited,
      fundAsset,
      updateNotification,
      gasPrice,
    } = blockchainContext;

    const { user } = metamaskContext;

    const {
      getPosts,
      getProfile,
      loadingThreeBox,
      getAvatar,
      syncingThreeBox
    } = threeBoxContext;

    if (loading.assets) {
      return (
        <Loading
          message="Loading asset information"
          hasBackButton
        />
      );
    }

    const asset = assets.find(({ assetId }) => assetId === this.props.assetId);
    let toRender;
    if (!asset) {
      toRender = (
        <ErrorPage
          title="Asset not found"
          description="If you feel like this is an error, please contact us."
        />
      );
    } else {
      const assetManager = assetManagers[asset.assetManager];
      toRender = (
        <AssetDetails
          asset={asset}
          handleAssetFavorited={handleAssetFavorited}
          fundAsset={fundAsset}
          updateNotification={updateNotification}
          loadingUserInfo={loading.userAssetsInfo}
          gasPrice={gasPrice}
          assetManager={assetManager}
          getPosts={getPosts}
          loadingThreeBox={loadingThreeBox}
          syncingThreeBox={syncingThreeBox}
          getProfile={getProfile}
          getAvatar={getAvatar}
          blockchainContext={blockchainContext}
          isAssetManager={asset.assetManager === user.address}
        />
      )
    }

    return(
      <React.Fragment>
        <GoBackTextAndArrow />
        {toRender}
      </React.Fragment>
    )
  }
}

const enhance = compose(
  withThreeBoxContext,
  withBlockchainContextPageWrapper,
  withMetamaskContextPageWrapper,
);

export default enhance(AssetPage);
