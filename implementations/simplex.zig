const std = @import("std");
const ArrayList = std.ArrayList;
const Allocator = std.mem.Allocator;

const Food = struct {
    name: []const u8,
    cost: f64,
    protein: f64,
    carbs: f64,
    fat: f64,
    fiber: f64,
    vitamins: f64,

    pub fn getNutrient(self: Food, index: usize) f64 {
        return switch (index) {
            0 => self.protein,
            1 => self.carbs,
            2 => self.fat,
            3 => self.fiber,
            4 => self.vitamins,
            else => 0.0,
        };
    }
};

const Constraints = struct {
    protein: f64,
    carbs: f64,
    fat: f64,
    fiber: f64,
    vitamins: f64,

    pub fn get(self: Constraints, index: usize) f64 {
        return switch (index) {
            0 => self.protein,
            1 => self.carbs,
            2 => self.fat,
            3 => self.fiber,
            4 => self.vitamins,
            else => 0.0,
        };
    }
};

const Tableau = struct {
    matrix: [][]f64,
    rows: usize,
    cols: usize,
    basis: []usize,
    allocator: Allocator,

    pub fn init(allocator: Allocator, rows: usize, cols: usize) !Tableau {
        var matrix = try allocator.alloc([]f64, rows);
        for (matrix) |*row| {
            row.* = try allocator.alloc(f64, cols);
            @memset(row.*, 0.0);
        }
        
        const basis = try allocator.alloc(usize, rows);
        @memset(basis, 0);

        return Tableau{
            .matrix = matrix,
            .rows = rows,
            .cols = cols,
            .basis = basis,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Tableau) void {
        for (self.matrix) |row| {
            self.allocator.free(row);
        }
        self.allocator.free(self.matrix);
        self.allocator.free(self.basis);
    }

    pub fn print(self: Tableau) void {
        std.debug.print("\n=== Simplex Tableau ===\n", .{});
        for (self.matrix, 0..) |row, i| {
            for (row) |val| {
                std.debug.print("{d:8.3} ", .{val});
            }
            if (i < self.rows - 1) {
                std.debug.print("| Basis: {d}", .{self.basis[i]});
            }
            std.debug.print("\n", .{});
        }
        std.debug.print("=======================\n", .{});
    }

    pub fn findPivotColumn(self: Tableau) ?usize {
        var pivot_col: ?usize = null;
        var min_val: f64 = 0.0;
        const obj_row = self.matrix[self.rows - 1];

        for (obj_row[0 .. self.cols - 1], 0..) |val, j| {
            if (val < min_val) {
                min_val = val;
                pivot_col = j;
            }
        }

        return pivot_col;
    }

    pub fn findPivotRow(self: Tableau, pivot_col: usize) ?usize {
        var pivot_row: ?usize = null;
        var min_ratio: f64 = std.math.inf(f64);
        const epsilon = 1e-6;

        for (0..self.rows - 1) |i| {
            const elem = self.matrix[i][pivot_col];
            if (elem < -epsilon) {
                const rhs = self.matrix[i][self.cols - 1];
                const ratio = -rhs / elem;
                if (ratio > 0 and ratio < min_ratio) {
                    min_ratio = ratio;
                    pivot_row = i;
                }
            }
        }

        return pivot_row;
    }

    pub fn pivot(self: *Tableau, pivot_row: usize, pivot_col: usize) void {
        const pivot_elem = self.matrix[pivot_row][pivot_col];

        for (self.matrix[pivot_row]) |*val| {
            val.* /= pivot_elem;
        }

        for (0..self.rows) |i| {
            if (i != pivot_row) {
                const factor = self.matrix[i][pivot_col];
                for (0..self.cols) |j| {
                    self.matrix[i][j] -= factor * self.matrix[pivot_row][j];
                }
            }
        }

        self.basis[pivot_row] = pivot_col;
    }
};

const Solution = struct {
    amounts: []f64,
    total_cost: f64,
    shadow_prices: []f64,
    feasible: bool,
    allocator: Allocator,

    pub fn init(allocator: Allocator, num_foods: usize, num_constraints: usize) !Solution {
        return Solution{
            .amounts = try allocator.alloc(f64, num_foods),
            .shadow_prices = try allocator.alloc(f64, num_constraints),
            .total_cost = 0.0,
            .feasible = true,
            .allocator = allocator,
        };
    }

    pub fn deinit(self: *Solution) void {
        self.allocator.free(self.amounts);
        self.allocator.free(self.shadow_prices);
    }
};

pub fn simplexSolve(
    allocator: Allocator,
    foods: []const Food,
    constraints: Constraints,
    verbose: bool,
) !?Solution {
    const num_foods = foods.len;
    const num_constraints: usize = 5;
    const num_vars = num_foods;
    const num_slack = num_constraints;
    const total_cols = num_vars + num_slack + 1;
    const total_rows = num_constraints + 1;

    var tableau = try Tableau.init(allocator, total_rows, total_cols);
    defer tableau.deinit();

    for (0..num_constraints) |i| {
        for (foods, 0..) |food, j| {
            tableau.matrix[i][j] = -food.getNutrient(i);
        }
        tableau.matrix[i][num_vars + i] = -1.0;
        tableau.matrix[i][total_cols - 1] = -constraints.get(i);
        tableau.basis[i] = num_vars + i;
    }

    for (foods, 0..) |food, j| {
        tableau.matrix[total_rows - 1][j] = food.cost;
    }

    if (verbose) {
        std.debug.print("\nInitial Tableau:\n", .{});
        tableau.print();
    }

    var iteration: usize = 0;
    const max_iterations: usize = 100;

    while (iteration < max_iterations) {
        const pivot_col = tableau.findPivotColumn() orelse {
            if (verbose) std.debug.print("\nOptimal solution found!\n", .{});
            break;
        };

        const pivot_row = tableau.findPivotRow(pivot_col) orelse {
            if (verbose) std.debug.print("\nProblem is unbounded!\n", .{});
            return null;
        };

        if (verbose) {
            std.debug.print("\nIteration {d}: Pivot at row {d}, column {d}\n", .{ iteration + 1, pivot_row, pivot_col });
        }

        tableau.pivot(pivot_row, pivot_col);

        if (verbose) {
            tableau.print();
        }

        iteration += 1;
    }

    var solution = try Solution.init(allocator, num_foods, num_constraints);
    @memset(solution.amounts, 0.0);
    @memset(solution.shadow_prices, 0.0);

    const epsilon = 1e-6;

    for (0..num_vars) |j| {
        var is_basic = false;
        var basic_row: ?usize = null;

        for (0..num_constraints) |i| {
            if (@abs(tableau.matrix[i][j] - 1.0) < epsilon) {
                var all_zero = true;
                for (0..num_constraints) |k| {
                    if (k != i and @abs(tableau.matrix[k][j]) > epsilon) {
                        all_zero = false;
                        break;
                    }
                }
                if (all_zero) {
                    is_basic = true;
                    basic_row = i;
                    break;
                }
            }
        }

        if (is_basic) {
            if (basic_row) |row| {
                solution.amounts[j] = @max(0.0, tableau.matrix[row][total_cols - 1]);
            }
        }
    }

    solution.total_cost = 0.0;
    for (foods, 0..) |food, j| {
        solution.total_cost += solution.amounts[j] * food.cost;
    }

    for (0..num_constraints) |i| {
        solution.shadow_prices[i] = @abs(tableau.matrix[total_rows - 1][num_vars + i]);
    }

    return solution;
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    const foods = [_]Food{
        .{ .name = "Oatmeal", .cost = 0.50, .protein = 5.0, .carbs = 27.0, .fat = 3.0, .fiber = 4.0, .vitamins = 15.0 },
        .{ .name = "Chicken Breast", .cost = 3.00, .protein = 31.0, .carbs = 0.0, .fat = 3.6, .fiber = 0.0, .vitamins = 10.0 },
        .{ .name = "Brown Rice", .cost = 0.30, .protein = 2.6, .carbs = 23.0, .fat = 0.9, .fiber = 1.8, .vitamins = 5.0 },
        .{ .name = "Broccoli", .cost = 1.50, .protein = 2.8, .carbs = 7.0, .fat = 0.4, .fiber = 2.6, .vitamins = 135.0 },
        .{ .name = "Banana", .cost = 0.25, .protein = 1.3, .carbs = 27.0, .fat = 0.3, .fiber = 3.1, .vitamins = 17.0 },
        .{ .name = "Eggs", .cost = 2.00, .protein = 13.0, .carbs = 1.1, .fat = 11.0, .fiber = 0.0, .vitamins = 15.0 },
        .{ .name = "Almonds", .cost = 4.50, .protein = 21.0, .carbs = 22.0, .fat = 49.0, .fiber = 12.0, .vitamins = 26.0 },
    };

    const constraints = Constraints{
        .protein = 50.0,
        .carbs = 130.0,
        .fat = 44.0,
        .fiber = 25.0,
        .vitamins = 100.0,
    };

    const constraint_names = [_][]const u8{
        "Protein (g)",
        "Carbohydrates (g)",
        "Fat (g)",
        "Fiber (g)",
        "Vitamins (%DV)",
    };

    const stdout = std.io.getStdOut().writer();

    try stdout.print("\n", .{});
    try stdout.print("╔════════════════════════════════════════════════════════╗\n", .{});
    try stdout.print("║  LINEAR PROGRAMMING: DIET OPTIMIZATION (ZIG)           ║\n", .{});
    try stdout.print("║  Simplex Algorithm Implementation                      ║\n", .{});
    try stdout.print("╚════════════════════════════════════════════════════════╝\n", .{});

    try stdout.print("\nConstraints (Minimum Daily Requirements):\n", .{});
    for (constraint_names, 0..) |name, i| {
        try stdout.print("  {s} >= {d:.1}\n", .{ name, constraints.get(i) });
    }

    try stdout.print("\nAvailable Foods:\n", .{});
    for (foods) |food| {
        try stdout.print("  {s:20}: ${d:.2}\n", .{ food.name, food.cost });
    }

    const verbose = false;
    const maybe_solution = try simplexSolve(allocator, &foods, constraints, verbose);

    if (maybe_solution) |*solution| {
        defer solution.deinit();

        try stdout.print("\n", .{});
        try stdout.print("========================================\n", .{});
        try stdout.print("      OPTIMAL DIET SOLUTION\n", .{});
        try stdout.print("========================================\n", .{});
        try stdout.print("\nMinimum Daily Cost: ${d:.2}\n", .{solution.total_cost});
        try stdout.print("\nFood Quantities:\n", .{});
        try stdout.print("----------------------------------------\n", .{});

        const epsilon = 1e-6;
        for (foods, 0..) |food, i| {
            if (solution.amounts[i] > epsilon) {
                try stdout.print("{s:20}: {d:8.2} units (${d:.2})\n", .{
                    food.name,
                    solution.amounts[i],
                    solution.amounts[i] * food.cost,
                });
            }
        }

        try stdout.print("\n", .{});
        try stdout.print("========================================\n", .{});
        try stdout.print("      SHADOW PRICES (Dual Values)\n", .{});
        try stdout.print("========================================\n", .{});
        try stdout.print("\nMarginal value of each constraint:\n", .{});
        try stdout.print("----------------------------------------\n", .{});

        for (constraint_names, 0..) |name, i| {
            try stdout.print("{s:20}: ${d:.6} per unit\n", .{ name, solution.shadow_prices[i] });
        }
        try stdout.print("\n", .{});
    } else {
        try stdout.print("\nNo feasible solution found!\n", .{});
    }
}