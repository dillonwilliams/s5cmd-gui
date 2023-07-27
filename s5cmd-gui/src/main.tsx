import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { setChonkyDefaults } from '@aperturerobotics/chonky';
import { ChonkyIconFA } from '@aperturerobotics/chonky-icon-fontawesome';
import S3Browser  from './components/S3Browser';
import BucketConfig from './components/BucketConfig';
import SecretConfig from './components/SecretConfig';
import {Bucket, Secret} from './types';
import { setSecret } from './api';

// We set Chonky defaults for FontAwesome icon pack.
setChonkyDefaults({ iconComponent: ChonkyIconFA });


const App: React.FC = () => {
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  
  const updateBucket = (bucket: Bucket) => {
    setSelectedBucket(bucket);
  }

  const updateSecret = (secret: Secret) => {
    setSelectedSecret(secret);
  }

  useEffect(() => {
    // Refresh the bucket and file browser when a new secret is selected
    if(selectedSecret) {
      // Code to refresh the bucket and file browser goes here
    }
  }, [selectedSecret]);

  return (
    <div>
      <SecretConfig updateSecret={updateSecret} />
      <BucketConfig updateBucket={updateBucket} selectedSecret={selectedSecret} />
      {selectedBucket && selectedSecret && (
        <S3Browser bucket={selectedBucket} secret={selectedSecret} />
      )}
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container!); 
root.render(<App  />);
