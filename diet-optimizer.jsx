import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Food {
  id: number;
  name: string;
  cost: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitamins: number;
}

interface Constraints {
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitamins: number;
}

interface Solution {
  amounts: number[];
  totalCost: number;
  shadowPrices: {[key: string]: number};
  iterations: number[][];
  feasible: boolean;
}

@Component({
  selector: 'app-root',
  template: `
    <div class="container">
      <header class="header">
        <h1>Linear Programming: Diet Optimization Calculator</h1>
        <p>The Classic 1945 Operations Research Problem - Minimize Cost Subject to Nutritional Constraints</p>
      </header>

      <div class="main-grid">
        <!-- Food Database Section -->
        <div class="panel">
          <div class="panel-header">
            <h2>Food Database</h2>
            <button class="btn-primary" (click)="addFood()">
              <span>➕</span> Add Food
            </button>
          </div>
          <div class="food-list">
            <div *ngFor="let food of foods" class="food-item">
              <div class="food-header">
                <input [(ngModel)]="food.name" class="food-name-input" />
                <button class="btn-danger" (click)="deleteFood(food.id)">🗑️</button>
              </div>
              <div class="food-nutrients">
                <div class="nutrient-input">
                  <label>Cost:</label>
                  <input type="number" [(ngModel)]="food.cost" step="0.1" />
                </div>
                <div class="nutrient-input">
                  <label>Protein:</label>
                  <input type="number" [(ngModel)]="food.protein" step="0.1" />
                </div>
                <div class="nutrient-input">
                  <label>Carbs:</label>
                  <input type="number" [(ngModel)]="food.carbs" step="0.1" />
                </div>
                <div class="nutrient-input">
                  <label>Fat:</label>
                  <input type="number" [(ngModel)]="food.fat" step="0.1" />
                </div>
                <div class="nutrient-input">
                  <label>Fiber:</label>
                  <input type="number" [(ngModel)]="food.fiber" step="0.1" />
                </div>
                <div class="nutrient-input">
                  <label>Vitamins:</label>
                  <input type="number" [(ngModel)]="food.vitamins" step="0.1" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Constraints Section -->
        <div class="panel">
          <h2>Nutritional Constraints (Minimum Daily Requirements)</h2>
          <div class="constraints-list">
            <div class="constraint-item">
              <label>Protein ≥</label>
              <input type="number" [(ngModel)]="constraints.protein" class="constraint-input" />
            </div>
            <div class="constraint-item">
              <label>Carbs ≥</label>
              <input type="number" [(ngModel)]="constraints.carbs" class="constraint-input" />
            </div>
            <div class="constraint-item">
              <label>Fat ≥</label>
              <input type="number" [(ngModel)]="constraints.fat" class="constraint-input" />
            </div>
            <div class="constraint-item">
              <label>Fiber ≥</label>
              <input type="number" [(ngModel)]="constraints.fiber" class="constraint-input" />
            </div>
            <div class="constraint-item">
              <label>Vitamins ≥</label>
              <input type="number" [(ngModel)]="constraints.vitamins" class="constraint-input" />
            </div>
          </div>
          <button class="btn-optimize" (click)="optimize()" [disabled]="loading">
            <span *ngIf="!loading">🧮 Optimize Diet</span>
            <span *ngIf="loading">⏳ Computing...</span>
          </button>
        </div>
      </div>

      <!-- Solution Section -->
      <div *ngIf="solution" class="solution-panel">
        <h2>💰 Optimal Solution</h2>
        <div class="total-cost">Minimum Daily Cost: \${{ solution.totalCost.toFixed(2) }}</div>
        <div class="food-results">
          <div *ngFor="let food of foods; let i = index" class="result-item" 
               [hidden]="solution.amounts[i] <= 0.01">
            <div class="result-name">{{ food.name }}</div>
            <div class="result-amount">{{ solution.amounts[i].toFixed(2) }} units</div>
            <div class="result-cost">\${{ (solution.amounts[i] * food.cost).toFixed(2) }}</div>
          </div>
        </div>

        <!-- Shadow Prices -->
        <div class="shadow-prices">
          <h2>📈 Shadow Prices (Dual Values)</h2>
          <p>How much would your optimal cost increase for each additional unit of constraint?</p>
          <div class="shadow-grid">
            <div *ngFor="let key of objectKeys(solution.shadowPrices)" class="shadow-item">
              <div class="shadow-label">{{ key }}</div>
              <div class="shadow-value">\${{ solution.shadowPrices[key].toFixed(6) }}/unit</div>
            </div>
          </div>
        </div>

        <!-- Developer Panel -->
        <div class="developer-panel">
          <button class="btn-secondary" (click)="showDeveloper = !showDeveloper">
            {{ showDeveloper ? '▼ Hide' : '▶ Show' }} Developer Control Panel
          </button>
          <div *ngIf="showDeveloper && solution.iterations" class="tableau-viewer">
            <h3>Simplex Tableau Iterations</h3>
            <div class="iteration-controls">
              <label>Iteration: {{ currentIteration + 1 }} / {{ solution.iterations.length }}</label>
              <input type="range" 
                     [min]="0" 
                     [max]="solution.iterations.length - 1"
                     [(ngModel)]="currentIteration"
                     class="iteration-slider" />
            </div>
            <pre class="tableau-display">{{ formatTableau(solution.iterations[currentIteration]) }}</pre>
            <div class="tableau-info">
              <p><strong>Tableau Structure:</strong></p>
              <ul>
                <li>Columns 0-{{ foods.length - 1 }}: Decision variables (food quantities)</li>
                <li>Columns {{ foods.length }}-{{ foods.length + 4 }}: Slack variables</li>
                <li>Last column: Right-hand side (RHS)</li>
                <li>Last row: Objective function (cost coefficients)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="error" class="error-panel">
        <h3>❌ Error</h3>
        <p>{{ error }}</p>
      </div>
    </div>
  `,
  styles: [`
    .container {
      font-family: Arial, sans-serif;
      background-color: #fff;
      min-height: 100vh;
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      border-bottom: 3px solid #FF6B35;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      font-size: 36px;
      font-weight: bold;
      color: #000;
      margin: 0 0 10px 0;
    }

    .header p {
      font-size: 16px;
      color: #333;
      margin: 0;
    }

    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 20px;
    }

    .panel {
      border: 2px solid #000;
      padding: 20px;
      background-color: #fff;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }

    .panel h2 {
      font-size: 20px;
      font-weight: bold;
      margin: 0 0 15px 0;
    }

    .btn-primary {
      background-color: #FF6B35;
      color: #fff;
      border: none;
      padding: 8px 15px;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .btn-primary:hover {
      background-color: #e55a2b;
    }

    .food-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .food-item {
      border: 1px solid #ddd;
      padding: 10px;
      margin-bottom: 10px;
      background-color: #f9f9f9;
    }

    .food-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .food-name-input {
      font-weight: bold;
      font-size: 14px;
      border: 1px solid #ccc;
      padding: 4px;
      flex: 1;
    }

    .btn-danger {
      background-color: #dc3545;
      color: #fff;
      border: none;
      padding: 4px 8px;
      border-radius: 3px;
      cursor: pointer;
      margin-left: 10px;
    }

    .food-nutrients {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      font-size: 12px;
    }

    .nutrient-input label {
      display: block;
      margin-bottom: 2px;
      text-transform: capitalize;
    }

    .nutrient-input input {
      width: 100%;
      padding: 4px;
      border: 1px solid #ccc;
      border-radius: 2px;
    }

    .constraints-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .constraint-item {
      background-color: #f9f9f9;
      padding: 15px;
      border: 1px solid #ddd;
    }

    .constraint-item label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      text-transform: capitalize;
      font-size: 14px;
    }

    .constraint-input {
      width: 100%;
      padding: 10px;
      font-size: 16px;
      border: 2px solid #FF6B35;
      border-radius: 4px;
    }

    .btn-optimize {
      width: 100%;
      background-color: #FF6B35;
      color: #fff;
      border: none;
      padding: 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      font-weight: bold;
      margin-top: 20px;
    }

    .btn-optimize:hover:not(:disabled) {
      background-color: #e55a2b;
    }

    .btn-optimize:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .solution-panel {
      border: 3px solid #FF6B35;
      padding: 20px;
      background-color: #FFF5F0;
      margin-bottom: 20px;
    }

    .solution-panel h2 {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 15px;
    }

    .total-cost {
      font-size: 32px;
      font-weight: bold;
      color: #FF6B35;
      margin-bottom: 20px;
    }

    .food-results {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .result-item {
      background-color: #fff;
      padding: 15px;
      border: 2px solid #FF6B35;
      border-radius: 4px;
    }

    .result-name {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 5px;
    }

    .result-amount {
      font-size: 20px;
      color: #FF6B35;
    }

    .result-cost {
      font-size: 14px;
      color: #666;
    }

    .shadow-prices {
      border: 2px solid #000;
      padding: 20px;
      margin-top: 20px;
      background-color: #fff;
    }

    .shadow-prices h2 {
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 15px;
    }

    .shadow-prices p {
      margin-bottom: 15px;
      color: #333;
    }

    .shadow-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }

    .shadow-item {
      background-color: #f9f9f9;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .shadow-label {
      text-transform: capitalize;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .shadow-value {
      font-size: 18px;
      color: #FF6B35;
    }

    .developer-panel {
      border: 2px solid #000;
      padding: 20px;
      margin-top: 20px;
      background-color: #f5f5f5;
    }

    .btn-secondary {
      background-color: #000;
      color: #fff;
      border: none;
      padding: 10px 20px;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 15px;
    }

    .tableau-viewer {
      margin-top: 15px;
    }

    .tableau-viewer h3 {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
    }

    .iteration-controls {
      margin-bottom: 15px;
    }

    .iteration-slider {
      width: 300px;
      margin-left: 10px;
    }

    .tableau-display {
      background-color: #fff;
      padding: 15px;
      border: 1px solid #ddd;
      overflow-x: auto;
      font-size: 11px;
      font-family: monospace;
    }

    .tableau-info {
      margin-top: 15px;
      font-size: 14px;
    }

    .tableau-info ul {
      margin-left: 20px;
    }

    .error-panel {
      border: 2px solid #dc3545;
      padding: 20px;
      background-color: #f8d7da;
      color: #721c24;
    }
  `]
})
export class AppComponent implements OnInit {
  foods: Food[] = [
    { id: 1, name: 'Oatmeal', cost: 0.50, protein: 5, carbs: 27, fat: 3, fiber: 4, vitamins: 15 },
    { id: 2, name: 'Chicken Breast', cost: 3.00, protein: 31, carbs: 0, fat: 3.6, fiber: 0, vitamins: 10 },
    { id: 3, name: 'Brown Rice', cost: 0.30, protein: 2.6, carbs: 23, fat: 0.9, fiber: 1.8, vitamins: 5 },
    { id: 4, name: 'Broccoli', cost: 1.50, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, vitamins: 135 },
    { id: 5, name: 'Banana', cost: 0.25, protein: 1.3, carbs: 27, fat: 0.3, fiber: 3.1, vitamins: 17 }
  ];

  constraints: Constraints = {
    protein: 50,
    carbs: 130,
    fat: 44,
    fiber: 25,
    vitamins: 100
  };

  solution: Solution | null = null;
  loading = false;
  error: string | null = null;
  showDeveloper = false;
  currentIteration = 0;

  constructor(private http: HttpClient) {}

  ngOnInit() {}

  addFood() {
    const newId = Math.max(...this.foods.map(f => f.id), 0) + 1;
    this.foods.push({
      id: newId,
      name: 'New Food',
      cost: 1.00,
      protein: 10,
      carbs: 20,
      fat: 5,
      fiber: 3,
      vitamins: 10
    });
  }

  deleteFood(id: number) {
    this.foods = this.foods.filter(f => f.id !== id);
  }

  optimize() {
    this.loading = true;
    this.error = null;
    this.solution = null;

    const payload = {
      foods: this.foods,
      constraints: this.constraints
    };

    this.http.post<Solution>('http://localhost:3000/api/optimize', payload)
      .subscribe({
        next: (result) => {
          this.solution = result;
          this.currentIteration = result.iterations ? result.iterations.length - 1 : 0;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.error || 'An error occurred during optimization';
          this.loading = false;
        }
      });
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  formatTableau(tab: number[][]): string {
    if (!tab) return '';
    return tab.map(row => 
      row.map(v => v.toFixed(3).padStart(8)).join(' | ')
    ).join('\n');
  }
}