import React from 'react';
import { useAppStore } from '../stores/appStore';

export const BucketSelector: React.FC = () => {
  const {
    buckets,
    selectedBucket,
    bucketsLoading,
    activeProfile,
    selectBucket,
    loadBuckets,
  } = useAppStore();

  if (!activeProfile) {
    return (
      <div className="bucket-selector">
        <select disabled>
          <option>Select a profile first</option>
        </select>
      </div>
    );
  }

  const handleBucketChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const bucketName = e.target.value;
    const bucket = buckets.find((b) => b.name === bucketName);
    if (bucket) {
      selectBucket(bucket);
    }
  };

  const handleRefresh = () => {
    loadBuckets();
  };

  return (
    <div className="bucket-selector">
      <label htmlFor="bucket-select">Bucket:</label>
      <select
        id="bucket-select"
        value={selectedBucket?.name || ''}
        onChange={handleBucketChange}
        disabled={bucketsLoading}
      >
        <option value="" disabled>
          {bucketsLoading ? 'Loading buckets...' : 'Select a bucket'}
        </option>
        {buckets.map((bucket) => (
          <option key={bucket.name} value={bucket.name}>
            {bucket.name}
          </option>
        ))}
      </select>
      <button
        className="icon-button"
        onClick={handleRefresh}
        disabled={bucketsLoading}
        title="Refresh bucket list"
      >
        ↻
      </button>
    </div>
  );
};

export default BucketSelector;
