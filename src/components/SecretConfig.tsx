import React, { useState, useEffect } from 'react';

type SecretConfigProps = {
  updateSecret: (secret: { accessKeyId: string; secretAccessKey: string }) => void;
};

const SecretConfig: React.FC<SecretConfigProps> = ({ updateSecret }) => {
  // State for the selected secret
  const [selectedSecret, setSelectedSecret] = useState<{ accessKeyId: string; secretAccessKey: string } | null>(null);

  // Retrieve stored secrets from localStorage
  const storedSecrets = JSON.parse(localStorage.getItem('secrets') || '[]');

  // Handler for selecting a secret
  const handleSelectSecret = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSecret = storedSecrets.find((secret: { accessKeyId: string; secretAccessKey: string }) => secret.accessKeyId === event.target.value);
    setSelectedSecret(selectedSecret);
  };

  // Update the selected secret when it changes
  useEffect(() => {
    if (selectedSecret) {
      updateSecret(selectedSecret);
    }
  }, [selectedSecret, updateSecret]);

  return (
    <div>
      <label htmlFor="secret-select">Select Secret:</label>
      <select id="secret-select" onChange={handleSelectSecret}>
        {storedSecrets.map((secret: { accessKeyId: string; secretAccessKey: string }) => (
          <option key={secret.accessKeyId} value={secret.accessKeyId}>
            {secret.accessKeyId}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SecretConfig;
