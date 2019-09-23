fs = require('fs');
readline = require('readline');
moment = require('moment');

// checks the given date for valid formats
// returns Date object if valid
// returns null if not valid
const validateDate = transDate => {
    let d = null;
    try {
        d = new Date(transDate);
        if (isNaN(d.getTime())) {
            d = null;
        }
    } catch (err) {
        console.log(`Error parsing date ${transDate}`)
    }
    return d;
};

// validate command line
if (process.argv.length < 3) {
   console.log('Usage: node filename [date]');
   console.log('    <fileName> is the name of the file containing the investor data');
   console.log('    [date] is an optional date. if specified, only transactions on or before this date are included ');
   return(-1);
}
// get the name of file to read
const fileName = process.argv[2];
// verify file exists
if( !fs.existsSync(fileName)) {
    console.log(`File "${fileName}" does not exist.`);
    return -1;
}
// generate output filename
let outputName = fileName;
if (fileName.indexOf('.csv') !== -1) {
    // has .csv, change to .json
    outputName = fileName.replace('.csv', '.json');
} else {
    outputName = outputName + '.json';
}

// get the latest date for which we desire transactions
// if date not specified, uses current date
let latest = validateDate(process.argv[3] || Date.now());
if (!latest) {
    console.log(`invalid date ${process.argv[3]} entered on command line. Using current date.`);
    // if invalid date specified, use current date
    latest = new Date();
}

const capOutput = {
    date: moment(latest).utc().format('MM/DD/YYYY'),
    cash_raised: 0,
    total_number_of_shares: 0,
    ownership: []
};

console.log(`'Recording transactions up to and including ${capOutput.date} in file ${outputName}`);

// process file line by line
const readLines = async () => {
    // open file as stream
    const fstream = fs.createReadStream(fileName);
    // create line reader
    const readOneLine = readline.createInterface({
        input: fstream,
        crlfDelay: Infinity     // treat crlf as single newline
    });
    // now read the lines and add to our table
    let lineNum = 0;
    for await (const line of readOneLine) {
        // remove excess space and parse line
        addCapLine(line.trim(), lineNum);
        lineNum++;
    }
};

const investors = {};

// parses given line and validates the values.
// if invalid values are found, the line is ignored and a warning displayed
// if transaction date is later than the request date, the line is ignored
// builds a table by investor name with accumulated values of all fields
// line format:
//   DATE SHARES PRICE INVESTOR
const addCapLine = (line, num) => {
    // ignore comments
    if (line.length === 0 || line[0] === '#') {
        return;
    }
    // split line into list of values
    let [transDate, shareCt, cost, investor] = line.split(',');
    // validate arguments 
    const transactionDate = validateDate(transDate);
    if (!transactionDate) {
        console.log(`ignoring transaction on line ${num} is with invalid date "${transDate}"`);
        return;
    }
    // convert to integer and validate
    shares = parseInt(shareCt, 10);
    if (isNaN(shares)) {
        console.log(`ignoring transaction on line ${num} with invalid number of shares "${shareCt}"`);
        return;
    }
    price = parseFloat(cost);
    if (isNaN(price)) {
        console.log(`ignoring transaction on line ${num} with invalid price "${cost}"`);
        return;
    }
    if (!investor || investor === '') {
        console.log(`ignoring transaction on line ${num} with invalid investor name "${investor}"`);
        return;
    }
    // ignore dates after specified latest
    if (transactionDate > latest) {
        console.log('ignoring transaction on line ', num, 'dated', transactionDate, '- after', capOutput.date);
        return;
    }
    // add or udate ownership by investor
    if(investor in investors) {
        const investorData = investors[investor];
        investorData.shares += shares;
        investorData.price += price;
    } else {
        investors[investor] = { shares, price };
    }
};

// addes investor data to output object
// calculates total shares and price 
// after total shares calculated, updates each investor with share perentage
const addInvestors = () => {
    // add all the ownership data and compute total cash/shares
    for (investor in investors) {
        let investorData = investors[investor];
        capOutput.cash_raised += investorData.price;
        capOutput.total_number_of_shares += investorData.shares;
        capOutput.ownership.push({
            investor,
            shares: investorData.shares,
            cash_paid: investorData.price
        });
    }
    if( capOutput.ownership.length === 0) {
        console.log("Warning: no investors found");
    } else {
        // now that we have the totals, compute the ownership share for each investor
        capOutput.ownership.forEach((investor, ix) => {
            investor.ownership = investor.shares/capOutput.total_number_of_shares;
            // convert to percentage and round to two decimals
            investor.ownership = Math.round(investor.ownership*10000)/100;
        });
    }
    return capOutput;
};

readLines()
    .then(() => {
        const output = addInvestors();
        const jsonContent = JSON.stringify(output);
        console.log(`Writing output to file "${outputName}"...`)
        fs.writeFile(outputName, jsonContent, (err) => {
            if (err) {
                console.log(`Error writing file "${outputName}":`);
                console.log(err);    
            }
        });
    });
