import React, { useState, useEffect } from 'react';
import { runS5cmd } from '../tauri/api';

// Define the type for the BucketConfig props
interface BucketConfigProps {
  updateBucket: (bucket: string) => void;
}

// Define the BucketConfig component
const BucketConfig: React.FC<BucketConfigProps> = ({ updateBucket }) => {
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>('');

  // Function to fetch buckets from S3 using s5cmd
  const fetchBuckets = async () => {
    const result = await runS5cmd('ls');
    setBuckets(result);
  }

  // Effect to fetch buckets when the component mounts
  useEffect(() => {
    fetchBuckets();
  }, []);

  // Function to handle bucket selection
  const handleBucketChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const bucket = event.target.value;
    setSelectedBucket(bucket);
    updateBucket(bucket);
  }

  return (
    <div>
      <label htmlFor="bucket-select">Bucket:</label>
      <select id="bucket-select" value={selectedBucket} onChange={handleBucketChange}>
        {buckets.map(bucket => (
          <option key={bucket} value={bucket}>{bucket}</option>
        ))}
      </select>
    </div>
  );
}

export default BucketConfig;
