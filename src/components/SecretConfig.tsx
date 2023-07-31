import React, { useState, useEffect } from 'react';
import { Secret } from '../types';

type SecretModalProps = {
  setVisible: (visible: boolean) => void;
};

const SecretModal: React.FC<SecretModalProps> = ({setVisible}) => {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [newSecret, setNewSecret] = useState<Secret>({
    nickname: "",
    accessKeyId: "",
    secretAccessKey: "",
  });

  useEffect(() => {
    // Fetch secrets from localStorage when the component mounts
    const storedSecrets = JSON.parse(localStorage.getItem('secrets') || '[]');
    setSecrets(storedSecrets);
  }, []);

  useEffect(() => {
    // add secret to localStorage when secret is added
    localStorage.setItem('secrets', JSON.stringify(secrets));
  }, [secrets]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSecret({
      ...newSecret,
      [e.target.name]: e.target.value,
    });
  };

  const handleDeleteSecret = (accessKeyId: string) => {
    const updatedSecrets = secrets.filter(
      (secret) => secret.accessKeyId !== accessKeyId
    );
    setSecrets(updatedSecrets);
  };

  const handleAddSecret = () => {
    if (newSecret.nickname && newSecret.accessKeyId && newSecret.secretAccessKey) {
      setSecrets([...secrets, newSecret]);
      setNewSecret({ nickname: "", accessKeyId: "", secretAccessKey: "" });
    }
  };

  return (
    <dialog>
      <table className="secrets__table">
        {secrets.length > 0 && (<tr>
          <th>Nickname</th>
          <th>Access key ID</th>
          <th />
        </tr>)
        }
        {secrets.map((secret: Secret) => (
          <tr key={secret.accessKeyId}>
            <td>{secret.nickname} </td>
            <td>{secret.accessKeyId} </td>
            <td className="delete-secret">
              <button onClick={() => handleDeleteSecret(secret.accessKeyId)}>
              × Forget
              </button>
            </td>
          </tr>
        ))}
      </table>
      <input
        type="text"
        name="accessKeyId"
        placeholder="Access Key ID"
        required={true}
        onChange={handleInputChange}
        value={newSecret.accessKeyId}
      />
      <input
        type="text"
        name="secretAccessKey"
        placeholder="Secret Access Key"
        required={true}
        onChange={handleInputChange}
        value={newSecret.secretAccessKey}
      />
      <input
        type="text"
        name="nickname"
        placeholder="Nickname"
        required={true}
        onChange={handleInputChange}
        value={newSecret.nickname}
      />
      <button onClick={handleAddSecret}>Save new secret</button>
      <button onClick={() => setVisible(false)}>
          Close
        </button>
    </dialog>
  );
};

type SecretConfigProps = {
  updateSecret: (secret: Secret) => void;
};

const SecretConfig: React.FC<SecretConfigProps> = ({ updateSecret }) => {
  // State for the selected secret
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [modalVisible, setModalVisible] = useState<boolean>(false);

  // Retrieve stored secrets from localStorage
  const storedSecrets = JSON.parse(localStorage.getItem('secrets') || '[]');

  // Handler for selecting a secret
  const handleSelectSecret = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedSecret = storedSecrets.find((secret: Secret) => secret.accessKeyId === event.target.value);
    setSelectedSecret(selectedSecret);
  };

  // Update the selected secret when it changes
  useEffect(() => {
    if (selectedSecret) {
      updateSecret(selectedSecret);
    }
  }, [selectedSecret, updateSecret]);

  // TODO not handling if selected secret is deleted....
  return (
    <div>
      <label htmlFor="secret-select">Secret:&nbsp;</label>
      <select id="secret-select" onChange={handleSelectSecret}>
        <option value="" disabled selected>Select a secret</option>
        {storedSecrets.map((secret: Secret) => (
          <option key={secret.accessKeyId} value={secret.accessKeyId}>
            {secret.nickname}
          </option>
        ))}
      </select>
      <span className="secrets__settings" onClick={() => setModalVisible(true)}>&nbsp;⚙</span>
      {modalVisible &&
        <SecretModal setVisible={setModalVisible} />
      }
    </div>
  );
};

export default SecretConfig;
