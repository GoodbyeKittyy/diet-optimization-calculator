const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

class Tableau {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.matrix = Array(rows).fill(0).map(() => Array(cols).fill(0));
        this.basis = Array(rows).fill(0);
    }

    findPivotColumn() {
        const objRow = this.matrix[this.rows - 1];
        let minVal = 0;
        let pivotCol = -1;

        for (let j = 0; j < this.cols - 1; j++) {
            if (objRow[j] < minVal) {
                minVal = objRow[j];
                pivotCol = j;
            }
        }

        return pivotCol;
    }

    findPivotRow(pivotCol) {
        let minRatio = Infinity;
        let pivotRow = -1;
        const epsilon = 1e-6;

        for (let i = 0; i < this.rows - 1; i++) {
            const elem = this.matrix[i][pivotCol];
            if (elem < -epsilon) {
                const rhs = this.matrix[i][this.cols - 1];
                const ratio = -rhs / elem;
                if (ratio > 0 && ratio < minRatio) {
                    minRatio = ratio;
                    pivotRow = i;
                }
            }
        }

        return pivotRow;
    }

    pivot(pivotRow, pivotCol) {
        const pivotElem = this.matrix[pivotRow][pivotCol];

        for (let j = 0; j < this.cols; j++) {
            this.matrix[pivotRow][j] /= pivotElem;
        }

        for (let i = 0; i < this.rows; i++) {
            if (i !== pivotRow) {
                const factor = this.matrix[i][pivotCol];
                for (let j = 0; j < this.cols; j++) {
                    this.matrix[i][j] -= factor * this.matrix[pivotRow][j];
                }
            }
        }

        this.basis[pivotRow] = pivotCol;
    }
}

function simplexSolve(foods, constraints) {
    const numFoods = foods.length;
    const numConstraints = 5;
    const constraintKeys = ['protein', 'carbs', 'fat', 'fiber', 'vitamins'];
    const numVars = numFoods;
    const numSlack = numConstraints;
    const totalCols = numVars + numSlack + 1;
    const totalRows = numConstraints + 1;

    const tableau = new Tableau(totalRows, totalCols);

    for (let i = 0; i < numConstraints; i++) {
        const key = constraintKeys[i];
        for (let j = 0; j < numFoods; j++) {
            tableau.matrix[i][j] = -foods[j][key];
        }
        tableau.matrix[i][numVars + i] = -1.0;
        tableau.matrix[i][totalCols - 1] = -constraints[key];
        tableau.basis[i] = numVars + i;
    }

    for (let j = 0; j < numFoods; j++) {
        tableau.matrix[totalRows - 1][j] = foods[j].cost;
    }

    let iteration = 0;
    const maxIterations = 100;
    const iterations = [];

    while (iteration < maxIterations) {
        iterations.push(JSON.parse(JSON.stringify(tableau.matrix)));

        const pivotCol = tableau.findPivotColumn();
        if (pivotCol === -1) break;

        const pivotRow = tableau.findPivotRow(pivotCol);
        if (pivotRow === -1) {
            return { error: 'Problem is unbounded' };
        }

        tableau.pivot(pivotRow, pivotCol);
        iteration++;
    }

    const amounts = Array(numFoods).fill(0);
    const epsilon = 1e-6;

    for (let j = 0; j < numVars; j++) {
        let isBasic = false;
        let basicRow = -1;

        for (let i = 0; i < numConstraints; i++) {
            if (Math.abs(tableau.matrix[i][j] - 1.0) < epsilon) {
                let allZero = true;
                for (let k = 0; k < numConstraints; k++) {
                    if (k !== i && Math.abs(tableau.matrix[k][j]) > epsilon) {
                        allZero = false;
                        break;
                    }
                }
                if (allZero) {
                    isBasic = true;
                    basicRow = i;
                    break;
                }
            }
        }

        if (isBasic && basicRow >= 0) {
            amounts[j] = Math.max(0, tableau.matrix[basicRow][totalCols - 1]);
        }
    }

    const totalCost = amounts.reduce((sum, amt, i) => sum + amt * foods[i].cost, 0);

    const shadowPrices = {};
    constraintKeys.forEach((key, i) => {
        shadowPrices[key] = Math.abs(tableau.matrix[totalRows - 1][numVars + i]);
    });

    return {
        amounts,
        totalCost,
        shadowPrices,
        iterations,
        feasible: true
    };
}

app.post('/api/optimize', (req, res) => {
    try {
        const { foods, constraints } = req.body;

        if (!foods || !constraints) {
            return res.status(400).json({ error: 'Missing foods or constraints' });
        }

        if (!Array.isArray(foods) || foods.length === 0) {
            return res.status(400).json({ error: 'Invalid foods array' });
        }

        const requiredConstraints = ['protein', 'carbs', 'fat', 'fiber', 'vitamins'];
        for (const key of requiredConstraints) {
            if (typeof constraints[key] !== 'number') {
                return res.status(400).json({ error: `Missing or invalid constraint: ${key}` });
            }
        }

        const result = simplexSolve(foods, constraints);

        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/sensitivity', (req, res) => {
    try {
        const { solution, foods } = req.body;

        if (!solution || !foods) {
            return res.status(400).json({ error: 'Missing solution or foods' });
        }

        const sensData = [];
        const epsilon = 1e-6;

        foods.forEach((food, idx) => {
            if (solution.amounts[idx] > epsilon) {
                const analysis = [];
                for (let pct = -50; pct <= 50; pct += 10) {
                    const newCost = food.cost * (1 + pct / 100);
                    const impact = solution.amounts[idx] * (newCost - food.cost);
                    analysis.push({
                        priceChange: pct,
                        newPrice: newCost,
                        impactOnTotal: impact
                    });
                }
                sensData.push({
                    food: food.name,
                    currentPrice: food.cost,
                    quantity: solution.amounts[idx],
                    analysis
                });
            }
        });

        res.json(sensData);
    } catch (error) {
        console.error('Sensitivity analysis error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.post('/api/dual', (req, res) => {
    try {
        const { foods, constraints } = req.body;

        if (!foods || !constraints) {
            return res.status(400).json({ error: 'Missing foods or constraints' });
        }

        const result = simplexSolve(foods, constraints);

        if (result.error) {
            return res.status(400).json(result);
        }

        const dualProblem = {
            primal: {
                objective: 'Minimize cost',
                constraints: 'Meet nutritional requirements',
                variables: foods.map(f => f.name)
            },
            dual: {
                objective: 'Maximize nutritional value',
                constraints: 'Stay within budget',
                variables: ['protein', 'carbs', 'fat', 'fiber', 'vitamins'],
                shadowPrices: result.shadowPrices
            },
            interpretation: Object.entries(result.shadowPrices).map(([nutrient, price]) => ({
                nutrient,
                shadowPrice: price,
                meaning: `Increasing ${nutrient} constraint by 1 unit would increase minimum cost by $${price.toFixed(6)}`
            }))
        };

        res.json(dualProblem);
    } catch (error) {
        console.error('Dual problem error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║  Diet Optimization API Server                          ║
║  Express.js Backend for Linear Programming             ║
╚════════════════════════════════════════════════════════╝

Server running on http://localhost:${PORT}

Available endpoints:
  POST /api/optimize     - Solve the diet optimization problem
  POST /api/sensitivity  - Perform sensitivity analysis
  POST /api/dual         - Get dual problem formulation
  GET  /api/health       - Health check

Example request to /api/optimize:
{
  "foods": [
    {"name": "Oatmeal", "cost": 0.50, "protein": 5, "carbs": 27, "fat": 3, "fiber": 4, "vitamins": 15},
    ...
  ],
  "constraints": {
    "protein": 50,
    "carbs": 130,
    "fat": 44,
    "fiber": 25,
    "vitamins": 100
  }
}
    `);
});