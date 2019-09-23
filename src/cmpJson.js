fs = require('fs');

const fnA = process.argv[2];
const fnB = process.argv[3];

const dataA = JSON.parse(fs.readFileSync(fnA).toString());
const dataB = JSON.parse(fs.readFileSync(fnB).toString());

delete dataA['date'];
delete dataB['date'];

if (JSON.stringify(dataA) === JSON.stringify(dataB)) {
    process.exit(0);
} else {
    process.exit(1);
}
