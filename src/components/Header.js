import React from 'react';

const Header = ({ lastUpdated }) => {
  return (
    <header>
      <h1>Meme Coin Scalping Dashboard</h1>
      <div id="last-updated">Last updated: {lastUpdated}</div>
    </header>
  );
};

export default Header;