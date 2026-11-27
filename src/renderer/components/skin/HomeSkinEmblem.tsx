import React, { useState } from 'react';

import { SkinAssetSlot } from '../../../shared/skin/constants';
import { useSkinAsset } from '../../providers/SkinProvider';
import { i18nService } from '../../services/i18n';

interface HomeSkinEmblemProps {
  className?: string;
}

const HomeSkinEmblem: React.FC<HomeSkinEmblemProps> = ({ className }) => {
  const assetUrl = useSkinAsset(SkinAssetSlot.HomeEmblem);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shouldUseSkinAsset = Boolean(assetUrl && failedUrl !== assetUrl);
  const imageClassName = [
    className,
    shouldUseSkinAsset ? 'rounded-xl object-cover' : undefined,
  ].filter(Boolean).join(' ');

  return (
    <img
      src={shouldUseSkinAsset ? assetUrl ?? 'gardy-mark.svg' : 'gardy-mark.svg'}
      alt={i18nService.t('cowork')}
      draggable={false}
      onError={() => {
        if (assetUrl) setFailedUrl(assetUrl);
      }}
      className={imageClassName}
    />
  );
};

export default HomeSkinEmblem;
