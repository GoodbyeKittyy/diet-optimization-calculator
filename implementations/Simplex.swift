import Foundation

struct Food {
    let name: String
    let cost: Double
    let nutrients: [Double]
    
    init(name: String, cost: Double, protein: Double, carbs: Double, fat: Double, fiber: Double, vitamins: Double) {
        self.name = name
        self.cost = cost
        self.nutrients = [protein, carbs, fat, fiber, vitamins]
    }
}

struct Constraints {
    let values: [Double]
    let names: [String]
    
    init(protein: Double, carbs: Double, fat: Double, fiber: Double, vitamins: Double) {
        self.values = [protein, carbs, fat, fiber, vitamins]
        self.names = ["Protein (g)", "Carbohydrates (g)", "Fat (g)", "Fiber (g)", "Vitamins (%DV)"]
    }
}

class Tableau {
    var matrix: [[Double]]
    let rows: Int
    let cols: Int
    var basis: [Int]
    
    init(rows: Int, cols: Int) {
        self.rows = rows
        self.cols = cols
        self.matrix = Array(repeating: Array(repeating: 0.0, count: cols), count: rows)
        self.basis = Array(repeating: 0, count: rows)
    }
    
    func print() {
        Swift.print("\n=== Simplex Tableau ===")
        for (i, row) in matrix.enumerated() {
            let rowStr = row.map { String(format: "%8.3f", $0) }.joined(separator: " ")
            if i < rows - 1 {
                Swift.print("\(rowStr) | Basis: \(basis[i])")
            } else {
                Swift.print(rowStr)
            }
        }
        Swift.print("=======================")
    }
    
    func findPivotColumn() -> Int? {
        let objRow = matrix[rows - 1]
        var minVal = 0.0
        var pivotCol: Int? = nil
        
        for (j, val) in objRow.prefix(cols - 1).enumerated() {
            if val < minVal {
                minVal = val
                pivotCol = j
            }
        }
        
        return pivotCol
    }
    
    func findPivotRow(pivotCol: Int) -> Int? {
        var minRatio = Double.infinity
        var pivotRow: Int? = nil
        let epsilon = 1e-6
        
        for i in 0..<(rows - 1) {
            let elem = matrix[i][pivotCol]
            if elem < -epsilon {
                let rhs = matrix[i][cols - 1]
                let ratio = -rhs / elem
                if ratio > 0 && ratio < minRatio {
                    minRatio = ratio
                    pivotRow = i
                }
            }
        }
        
        return pivotRow
    }
    
    func pivot(pivotRow: Int, pivotCol: Int) {
        let pivotElem = matrix[pivotRow][pivotCol]
        
        for j in 0..<cols {
            matrix[pivotRow][j] /= pivotElem
        }
        
        for i in 0..<rows where i != pivotRow {
            let factor = matrix[i][pivotCol]
            for j in 0..<cols {
                matrix[i][j] -= factor * matrix[pivotRow][j]
            }
        }
        
        basis[pivotRow] = pivotCol
    }
}

struct Solution {
    let amounts: [Double]
    let totalCost: Double
    let shadowPrices: [Double]
    let feasible: Bool
}

class SimplexSolver {
    static func solve(foods: [Food], constraints: Constraints, verbose: Bool = false) -> Solution? {
        let numFoods = foods.count
        let numConstraints = constraints.values.count
        let numVars = numFoods
        let numSlack = numConstraints
        let totalCols = numVars + numSlack + 1
        let totalRows = numConstraints + 1
        
        let tableau = Tableau(rows: totalRows, cols: totalCols)
        
        for i in 0..<numConstraints {
            for (j, food) in foods.enumerated() {
                tableau.matrix[i][j] = -food.nutrients[i]
            }
            tableau.matrix[i][numVars + i] = -1.0
            tableau.matrix[i][totalCols - 1] = -constraints.values[i]
            tableau.basis[i] = numVars + i
        }
        
        for (j, food) in foods.enumerated() {
            tableau.matrix[totalRows - 1][j] = food.cost
        }
        
        if verbose {
            print("\nInitial Tableau:")
            tableau.print()
        }
        
        var iteration = 0
        let maxIterations = 100
        
        while iteration < maxIterations {
            guard let pivotCol = tableau.findPivotColumn() else {
                if verbose { print("\nOptimal solution found!") }
                break
            }
            
            guard let pivotRow = tableau.findPivotRow(pivotCol: pivotCol) else {
                if verbose { print("\nProblem is unbounded!") }
                return nil
            }
            
            if verbose {
                print("\nIteration \(iteration + 1): Pivot at row \(pivotRow), column \(pivotCol)")
            }
            
            tableau.pivot(pivotRow: pivotRow, pivotCol: pivotCol)
            
            if verbose {
                tableau.print()
            }
            
            iteration += 1
        }
        
        var amounts = Array(repeating: 0.0, count: numFoods)
        let epsilon = 1e-6
        
        for j in 0..<numVars {
            var isBasic = false
            var basicRow: Int? = nil
            
            for i in 0..<numConstraints {
                if abs(tableau.matrix[i][j] - 1.0) < epsilon {
                    var allZero = true
                    for k in 0..<numConstraints where k != i {
                        if abs(tableau.matrix[k][j]) > epsilon {
                            allZero = false
                            break
                        }
                    }
                    if allZero {
                        isBasic = true
                        basicRow = i
                        break
                    }
                }
            }
            
            if isBasic, let row = basicRow {
                amounts[j] = max(0.0, tableau.matrix[row][totalCols - 1])
            }
        }
        
        let totalCost = zip(amounts, foods).reduce(0.0) { $0 + $1.0 * $1.1.cost }
        
        var shadowPrices = Array(repeating: 0.0, count: numConstraints)
        for i in 0..<numConstraints {
            shadowPrices[i] = abs(tableau.matrix[totalRows - 1][numVars + i])
        }
        
        return Solution(amounts: amounts, totalCost: totalCost, shadowPrices: shadowPrices, feasible: true)
    }
    
    static func printSolution(_ solution: Solution, foods: [Food], constraints: Constraints) {
        print("\n")
        print("========================================")
        print("      OPTIMAL DIET SOLUTION")
        print("========================================")
        print("\nMinimum Daily Cost: $\(String(format: "%.2f", solution.totalCost))")
        print("\nFood Quantities:")
        print("----------------------------------------")
        
        let epsilon = 1e-6
        for (i, food) in foods.enumerated() {
            if solution.amounts[i] > epsilon {
                let cost = solution.amounts[i] * food.cost
                print("\(food.name.padding(toLength: 20, withPad: " ", startingAt: 0)): \(String(format: "%8.2f", solution.amounts[i])) units ($\(String(format: "%.2f", cost)))")
            }
        }
        
        print("\n========================================")
        print("      SHADOW PRICES (Dual Values)")
        print("========================================")
        print("\nMarginal value of each constraint:")
        print("----------------------------------------")
        
        for (i, name) in constraints.names.enumerated() {
            print("\(name.padding(toLength: 20, withPad: " ", startingAt: 0)): $\(String(format: "%.6f", solution.shadowPrices[i])) per unit")
        }
        print()
    }
    
    static func sensitivityAnalysis(_ solution: Solution, foods: [Food]) {
        print("\n========================================")
        print("      SENSITIVITY ANALYSIS")
        print("========================================")
        
        let epsilon = 1e-6
        for (i, food) in foods.enumerated() {
            if solution.amounts[i] > epsilon {
                print("\n\(food.name) (Current: $\(String(format: "%.2f", food.cost)), Quantity: \(String(format: "%.2f", solution.amounts[i])))")
                print("Price Change | New Price | Cost Impact")
                print("----------------------------------------")
                
                for pct in stride(from: -50, through: 50, by: 10) {
                    let newPrice = food.cost * (1.0 + Double(pct) / 100.0)
                    let impact = solution.amounts[i] * (newPrice - food.cost)
                    print("\(String(format: "%4d%%", pct))       | $\(String(format: "%7.2f", newPrice))  | $\(String(format: "%7.2f", impact))")
                }
            }
        }
        print()
    }
}

let foods = [
    Food(name: "Oatmeal", cost: 0.50, protein: 5.0, carbs: 27.0, fat: 3.0, fiber: 4.0, vitamins: 15.0),
    Food(name: "Chicken Breast", cost: 3.00, protein: 31.0, carbs: 0.0, fat: 3.6, fiber: 0.0, vitamins: 10.0),
    Food(name: "Brown Rice", cost: 0.30, protein: 2.6, carbs: 23.0, fat: 0.9, fiber: 1.8, vitamins: 5.0),
    Food(name: "Broccoli", cost: 1.50, protein: 2.8, carbs: 7.0, fat: 0.4, fiber: 2.6, vitamins: 135.0),
    Food(name: "Banana", cost: 0.25, protein: 1.3, carbs: 27.0, fat: 0.3, fiber: 3.1, vitamins: 17.0),
    Food(name: "Eggs", cost: 2.00, protein: 13.0, carbs: 1.1, fat: 11.0, fiber: 0.0, vitamins: 15.0),
    Food(name: "Almonds", cost: 4.50, protein: 21.0, carbs: 22.0, fat: 49.0, fiber: 12.0, vitamins: 26.0)
]

let constraints = Constraints(protein: 50.0, carbs: 130.0, fat: 44.0, fiber: 25.0, vitamins: 100.0)

print("\n")
print("╔════════════════════════════════════════════════════════╗")
print("║  LINEAR PROGRAMMING: DIET OPTIMIZATION (SWIFT)         ║")
print("║  Simplex Algorithm Implementation                      ║")
print("╚════════════════════════════════════════════════════════╝")

print("\nConstraints (Minimum Daily Requirements):")
for (i, name) in constraints.names.enumerated() {
    print("  \(name) >= \(String(format: "%.1f", constraints.values[i]))")
}

print("\nAvailable Foods:")
for food in foods {
    print("  \(food.name.padding(toLength: 20, withPad: " ", startingAt: 0)): $\(String(format: "%.2f", food.cost))")
}

if let solution = SimplexSolver.solve(foods: foods, constraints: constraints, verbose: false) {
    SimplexSolver.printSolution(solution, foods: foods, constraints: constraints)
    SimplexSolver.sensitivityAnalysis(solution, foods: foods)
} else {
    print("\nNo feasible solution found!")
}