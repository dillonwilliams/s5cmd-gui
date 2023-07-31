import React, { useState, useEffect } from 'react';
import { runS5cmd, setSecret } from '../api';
import { Bucket, Secret } from '../types';
import { fixJsonData } from '../utils';

// Define the type for the BucketConfig props
interface BucketConfigProps {
  updateBucket: (bucket: Bucket) => void;
  selectedSecret: Secret | null;
}

const BucketConfig: React.FC<BucketConfigProps> = ({ updateBucket, selectedSecret }) => {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');

  const fetchBuckets = async () => {
    const rawBucketsData = await runS5cmd('ls', []);
    // deal with s5cmd's invalid JSON here
    console.log('fetched BUCKETS')
    console.log(rawBucketsData);

    const bucketResults = fixJsonData(rawBucketsData)
    const buckets = bucketResults.map((r: any) => ({name: r.name}));

    setBuckets(buckets);
  }

  useEffect(() => {
    console.log('Preparing to fetch buckets');
    if (selectedSecret) {
      setSecret(selectedSecret.accessKeyId, selectedSecret.secretAccessKey);
      fetchBuckets();
    }
  }, [selectedSecret]);

  // Function to handle bucket selection
  const handleBucketChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const bucket = event.target.value;
    setSelectedBucket(bucket);
    updateBucket({name: bucket});
  }

  return (
    <div>
      <label htmlFor="bucket-select">Bucket:&nbsp;</label>
      <select id="bucket-select" value={selectedBucket} onChange={handleBucketChange}>
        {buckets.map(bucket => (
          <option key={bucket.name} value={bucket.name}>{bucket.name}</option>
        ))}
      </select>
    </div>
  );
}

export default BucketConfig;
