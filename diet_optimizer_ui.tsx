import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter } from 'recharts';
import { Plus, Trash2, Calculator, RefreshCw, TrendingUp, DollarSign } from 'lucide-react';

const DietOptimizer = () => {
  const [foods, setFoods] = useState([
    { id: 1, name: 'Oatmeal', cost: 0.50, protein: 5, carbs: 27, fat: 3, fiber: 4, vitamins: 15 },
    { id: 2, name: 'Chicken Breast', cost: 3.00, protein: 31, carbs: 0, fat: 3.6, fiber: 0, vitamins: 10 },
    { id: 3, name: 'Brown Rice', cost: 0.30, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8, vitamins: 5 },
    { id: 4, name: 'Broccoli', cost: 1.50, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, vitamins: 135 },
    { id: 5, name: 'Banana', cost: 0.25, protein: 1.3, carbs: 27, fat: 0.3, fiber: 3.1, vitamins: 17 }
  ]);

  const [constraints, setConstraints] = useState({
    protein: 50,
    carbs: 130,
    fat: 44,
    fiber: 25,
    vitamins: 100
  });

  const [solution, setSolution] = useState(null);
  const [tableau, setTableau] = useState([]);
  const [iteration, setIteration] = useState(0);
  const [shadowPrices, setShadowPrices] = useState({});
  const [sensitivityData, setSensitivityData] = useState([]);
  const [showDeveloper, setShowDeveloper] = useState(false);

  const simplex = () => {
    const numVars = foods.length;
    const numConstraints = 5;
    
    // Initialize tableau: [constraints | slack | RHS]
    let tab = [];
    const constraintNames = ['protein', 'carbs', 'fat', 'fiber', 'vitamins'];
    
    // Add constraint rows
    constraintNames.forEach((constraint, i) => {
      let row = [];
      foods.forEach(food => {
        row.push(-food[constraint]); // Negative for >= constraints
      });
      // Slack variables
      for (let j = 0; j < numConstraints; j++) {
        row.push(i === j ? -1 : 0);
      }
      row.push(-constraints[constraint]); // RHS
      tab.push(row);
    });

    // Objective function row (minimize cost)
    let objRow = [];
    foods.forEach(food => objRow.push(food.cost));
    for (let j = 0; j < numConstraints; j++) objRow.push(0);
    objRow.push(0);
    tab.push(objRow);

    let iterations = [];
    let iter = 0;
    const maxIter = 50;

    // Simplex iterations
    while (iter < maxIter) {
      iterations.push(JSON.parse(JSON.stringify(tab)));
      
      // Find entering variable (most negative in objective row)
      let objRow = tab[tab.length - 1];
      let enterCol = -1;
      let minVal = 0;
      
      for (let j = 0; j < objRow.length - 1; j++) {
        if (objRow[j] < minVal) {
          minVal = objRow[j];
          enterCol = j;
        }
      }
      
      if (enterCol === -1) break; // Optimal solution found

      // Find leaving variable (minimum ratio test)
      let leaveRow = -1;
      let minRatio = Infinity;
      
      for (let i = 0; i < tab.length - 1; i++) {
        if (tab[i][enterCol] < 0) {
          let ratio = -tab[i][tab[i].length - 1] / tab[i][enterCol];
          if (ratio > 0 && ratio < minRatio) {
            minRatio = ratio;
            leaveRow = i;
          }
        }
      }
      
      if (leaveRow === -1) break; // Unbounded

      // Pivot operation
      let pivot = tab[leaveRow][enterCol];
      for (let j = 0; j < tab[leaveRow].length; j++) {
        tab[leaveRow][j] /= pivot;
      }

      for (let i = 0; i < tab.length; i++) {
        if (i !== leaveRow) {
          let factor = tab[i][enterCol];
          for (let j = 0; j < tab[i].length; j++) {
            tab[i][j] -= factor * tab[leaveRow][j];
          }
        }
      }

      iter++;
    }

    // Extract solution
    let amounts = Array(numVars).fill(0);
    for (let j = 0; j < numVars; j++) {
      let col = tab.map(row => row[j]);
      let nonZero = col.filter(v => Math.abs(v) > 1e-6);
      if (nonZero.length === 1 && Math.abs(nonZero[0] - 1) < 1e-6) {
        let rowIdx = col.findIndex(v => Math.abs(v - 1) < 1e-6);
        amounts[j] = Math.max(0, tab[rowIdx][tab[rowIdx].length - 1]);
      }
    }

    let totalCost = amounts.reduce((sum, amt, i) => sum + amt * foods[i].cost, 0);

    // Calculate shadow prices (dual values from slack columns)
    let shadows = {};
    constraintNames.forEach((name, i) => {
      let slackCol = numVars + i;
      shadows[name] = Math.abs(tab[tab.length - 1][slackCol]);
    });

    setSolution({ amounts, totalCost });
    setTableau(iterations);
    setIteration(iterations.length - 1);
    setShadowPrices(shadows);
    
    // Generate sensitivity analysis
    generateSensitivityAnalysis(amounts, totalCost);
  };

  const generateSensitivityAnalysis = (amounts, baseCost) => {
    let sensData = [];
    foods.forEach((food, idx) => {
      if (amounts[idx] > 0.01) {
        for (let pctChange = -50; pctChange <= 50; pctChange += 10) {
          let newCost = food.cost * (1 + pctChange / 100);
          sensData.push({
            food: food.name,
            priceChange: pctChange,
            newPrice: newCost.toFixed(2),
            impactOnTotal: (amounts[idx] * (newCost - food.cost)).toFixed(2)
          });
        }
      }
    });
    setSensitivityData(sensData);
  };

  const addFood = () => {
    setFoods([...foods, {
      id: Date.now(),
      name: 'New Food',
      cost: 1.00,
      protein: 10,
      carbs: 20,
      fat: 5,
      fiber: 3,
      vitamins: 10
    }]);
  };

  const deleteFood = (id) => {
    setFoods(foods.filter(f => f.id !== id));
  };

  const updateFood = (id, field, value) => {
    setFoods(foods.map(f => f.id === id ? { ...f, [field]: parseFloat(value) || 0 } : f));
  };

  const updateConstraint = (field, value) => {
    setConstraints({ ...constraints, [field]: parseFloat(value) || 0 });
  };

  const formatTableau = (tab) => {
    if (!tab || tab.length === 0) return null;
    return tab.map(row => row.map(v => v.toFixed(3)).join(' | ')).join('\n');
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', backgroundColor: '#fff', minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ borderBottom: '3px solid #FF6B35', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#000', margin: '0 0 10px 0' }}>
            Linear Programming: Diet Optimization Calculator
          </h1>
          <p style={{ fontSize: '16px', color: '#333', margin: 0 }}>
            The Classic 1945 Operations Research Problem - Minimize Cost Subject to Nutritional Constraints
          </p>
        </div>

        {/* Main Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Food Database */}
          <div style={{ border: '2px solid #000', padding: '20px', backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>Food Database</h2>
              <button
                onClick={addFood}
                style={{ backgroundColor: '#FF6B35', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Plus size={16} /> Add Food
              </button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {foods.map(food => (
                <div key={food.id} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px', backgroundColor: '#f9f9f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <input
                      value={food.name}
                      onChange={(e) => setFoods(foods.map(f => f.id === food.id ? { ...f, name: e.target.value } : f))}
                      style={{ fontWeight: 'bold', fontSize: '14px', border: '1px solid #ccc', padding: '4px', flex: 1 }}
                    />
                    <button onClick={() => deleteFood(food.id)} style={{ backgroundColor: '#dc3545', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '3px', cursor: 'pointer', marginLeft: '10px' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12px' }}>
                    {['cost', 'protein', 'carbs', 'fat', 'fiber', 'vitamins'].map(field => (
                      <div key={field}>
                        <label style={{ display: 'block', marginBottom: '2px', textTransform: 'capitalize' }}>{field}:</label>
                        <input
                          type="number"
                          step="0.1"
                          value={food[field]}
                          onChange={(e) => updateFood(food.id, field, e.target.value)}
                          style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '2px' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nutritional Constraints */}
          <div style={{ border: '2px solid #000', padding: '20px', backgroundColor: '#fff' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Nutritional Constraints (Minimum Daily Requirements)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {Object.keys(constraints).map(key => (
                <div key={key} style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ddd' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', textTransform: 'capitalize', fontSize: '14px' }}>
                    {key} ≥
                  </label>
                  <input
                    type="number"
                    value={constraints[key]}
                    onChange={(e) => updateConstraint(key, e.target.value)}
                    style={{ width: '100%', padding: '10px', fontSize: '16px', border: '2px solid #FF6B35', borderRadius: '4px' }}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={simplex}
              style={{ width: '100%', backgroundColor: '#FF6B35', color: '#fff', border: 'none', padding: '15px', borderRadius: '4px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              <Calculator size={20} /> Optimize Diet
            </button>
          </div>
        </div>

        {/* Solution Display */}
        {solution && (
          <>
            <div style={{ border: '3px solid #FF6B35', padding: '20px', backgroundColor: '#FFF5F0', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DollarSign size={24} /> Optimal Solution
              </h2>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#FF6B35', marginBottom: '20px' }}>
                Minimum Daily Cost: ${solution.totalCost.toFixed(2)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                {foods.map((food, idx) => solution.amounts[idx] > 0.01 && (
                  <div key={food.id} style={{ backgroundColor: '#fff', padding: '15px', border: '2px solid #FF6B35', borderRadius: '4px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px' }}>{food.name}</div>
                    <div style={{ fontSize: '20px', color: '#FF6B35' }}>{solution.amounts[idx].toFixed(2)} units</div>
                    <div style={{ fontSize: '14px', color: '#666' }}>Cost: ${(solution.amounts[idx] * food.cost).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shadow Prices */}
            <div style={{ border: '2px solid #000', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TrendingUp size={20} /> Shadow Prices (Dual Values)
              </h2>
              <p style={{ marginBottom: '15px', color: '#333' }}>
                How much would your optimal cost increase for each additional unit of constraint?
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                {Object.keys(shadowPrices).map(key => (
                  <div key={key} style={{ backgroundColor: '#f9f9f9', padding: '12px', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <div style={{ textTransform: 'capitalize', fontWeight: 'bold', marginBottom: '5px' }}>{key}</div>
                    <div style={{ fontSize: '18px', color: '#FF6B35' }}>${shadowPrices[key].toFixed(4)}/unit</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sensitivity Analysis */}
            <div style={{ border: '2px solid #000', padding: '20px', marginBottom: '20px', backgroundColor: '#fff' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px' }}>Post-Optimality Sensitivity Analysis</h2>
              <p style={{ marginBottom: '15px', color: '#333' }}>
                Impact of price changes on total cost for foods in optimal solution
              </p>
              {foods.filter((_, idx) => solution.amounts[idx] > 0.01).map((food, i) => (
                <div key={i} style={{ marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px' }}>{food.name}</h3>
                  <LineChart width={600} height={200} data={sensitivityData.filter(d => d.food === food.name)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priceChange" label={{ value: 'Price Change (%)', position: 'insideBottom', offset: -5 }} />
                    <YAxis label={{ value: 'Cost Impact ($)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="impactOnTotal" stroke="#FF6B35" strokeWidth={2} />
                  </LineChart>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Developer Control Panel */}
        <div style={{ border: '2px solid #000', padding: '20px', backgroundColor: '#f5f5f5' }}>
          <button
            onClick={() => setShowDeveloper(!showDeveloper)}
            style={{ backgroundColor: '#000', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <RefreshCw size={16} /> {showDeveloper ? 'Hide' : 'Show'} Developer Control Panel
          </button>
          
          {showDeveloper && tableau.length > 0 && (
            <>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>Simplex Tableau Iterations</h3>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ marginRight: '10px' }}>Iteration: {iteration + 1} / {tableau.length}</label>
                <input
                  type="range"
                  min="0"
                  max={tableau.length - 1}
                  value={iteration}
                  onChange={(e) => setIteration(parseInt(e.target.value))}
                  style={{ width: '300px' }}
                />
              </div>
              <pre style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd', overflowX: 'auto', fontSize: '11px', fontFamily: 'monospace' }}>
                {formatTableau(tableau[iteration])}
              </pre>
              <div style={{ marginTop: '15px', fontSize: '14px' }}>
                <p><strong>Tableau Structure:</strong></p>
                <ul style={{ marginLeft: '20px' }}>
                  <li>Columns 0-{foods.length - 1}: Decision variables (food quantities)</li>
                  <li>Columns {foods.length}-{foods.length + 4}: Slack variables</li>
                  <li>Last column: Right-hand side (RHS)</li>
                  <li>Last row: Objective function (cost coefficients)</li>
                </ul>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DietOptimizer;