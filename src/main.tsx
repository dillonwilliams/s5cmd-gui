import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Chonky, ChonkyIconFA, setChonkyDefaults } from 'chonky';
import { S3Browser } from './components/S3Browser';
import { BucketConfig } from './components/BucketConfig';
import { SecretConfig } from './components/SecretConfig';

// We set Chonky defaults for FontAwesome icon pack.
setChonkyDefaults({ iconComponent: ChonkyIconFA });

type Bucket = {
  name: string;
};

type Secret = {
  accessKeyId: string;
  secretAccessKey: string;
};

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
      <BucketConfig updateBucket={updateBucket} />
      <SecretConfig updateSecret={updateSecret} />
      {selectedBucket && selectedSecret && (
        <S3Browser bucket={selectedBucket} secret={selectedSecret} />
      )}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('app'));
