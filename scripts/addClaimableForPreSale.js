const { ethers } = require('hardhat');
const csv = require('fast-csv');
const fs = require('fs');
const path = require('path');

let CSV_FILE = path.resolve(__dirname, '..', 'presale.csv');

if (process.env.NODE_ENV !== 'production') {
  CSV_FILE = path.resolve(__dirname, '..', 'presale_test.csv');
}

function readCSV() {
  return new Promise((resolve, reject) => {
    const result = [];

    csv
      .parseFile(CSV_FILE, { headers: true })
      .on('error', (error) => reject(error))
      .on('data', (row) =>
        result.push({ address: row.User, amount: row.Total }),
      )
      .on('end', () => resolve(result));
  });
}

async function main() {
  const vestingAddress = (await deployments.get('Vesting')).address;
  const Vesting = await ethers.getContractFactory('Vesting');
  const vesting = Vesting.attach(vestingAddress);

  const rows = await readCSV();

  for (let current = 0; current < rows.length; current += 1) {
    const { address, amount } = rows[current];

    try {
      await vesting.addUniqueClaimable(
        address,
        ethers.utils.parseUnits(amount, 18),
      );
    } catch (e) {
      console.error(address, amount, e.error);
    }
  }

  const total = rows.reduce((memo, row) => memo + parseInt(row.amount, 10), 0);

  console.log(`\nYou need to deposit ${total} QUARTZ`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
