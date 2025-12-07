#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#define MAX_FOODS 50
#define MAX_CONSTRAINTS 10
#define EPSILON 1e-6

typedef struct {
    char name[50];
    double cost;
    double nutrients[MAX_CONSTRAINTS];
} Food;

typedef struct {
    double** matrix;
    int rows;
    int cols;
    int* basis;
} Tableau;

typedef struct {
    double* amounts;
    double total_cost;
    double* shadow_prices;
    int feasible;
} Solution;

Tableau* create_tableau(int rows, int cols) {
    Tableau* t = (Tableau*)malloc(sizeof(Tableau));
    t->rows = rows;
    t->cols = cols;
    t->matrix = (double**)malloc(rows * sizeof(double*));
    for (int i = 0; i < rows; i++) {
        t->matrix[i] = (double*)calloc(cols, sizeof(double));
    }
    t->basis = (int*)malloc(rows * sizeof(int));
    return t;
}

void free_tableau(Tableau* t) {
    for (int i = 0; i < t->rows; i++) {
        free(t->matrix[i]);
    }
    free(t->matrix);
    free(t->basis);
    free(t);
}

void print_tableau(Tableau* t) {
    printf("\n=== Simplex Tableau ===\n");
    for (int i = 0; i < t->rows; i++) {
        for (int j = 0; j < t->cols; j++) {
            printf("%8.3f ", t->matrix[i][j]);
        }
        if (i < t->rows - 1) {
            printf("| Basis: %d", t->basis[i]);
        }
        printf("\n");
    }
    printf("=======================\n");
}

int find_pivot_column(Tableau* t) {
    int pivot_col = -1;
    double min_val = 0.0;
    
    for (int j = 0; j < t->cols - 1; j++) {
        if (t->matrix[t->rows - 1][j] < min_val) {
            min_val = t->matrix[t->rows - 1][j];
            pivot_col = j;
        }
    }
    
    return pivot_col;
}

int find_pivot_row(Tableau* t, int pivot_col) {
    int pivot_row = -1;
    double min_ratio = INFINITY;
    
    for (int i = 0; i < t->rows - 1; i++) {
        if (t->matrix[i][pivot_col] < -EPSILON) {
            double ratio = -t->matrix[i][t->cols - 1] / t->matrix[i][pivot_col];
            if (ratio > 0 && ratio < min_ratio) {
                min_ratio = ratio;
                pivot_row = i;
            }
        }
    }
    
    return pivot_row;
}

void pivot_operation(Tableau* t, int pivot_row, int pivot_col) {
    double pivot_element = t->matrix[pivot_row][pivot_col];
    
    for (int j = 0; j < t->cols; j++) {
        t->matrix[pivot_row][j] /= pivot_element;
    }
    
    for (int i = 0; i < t->rows; i++) {
        if (i != pivot_row) {
            double factor = t->matrix[i][pivot_col];
            for (int j = 0; j < t->cols; j++) {
                t->matrix[i][j] -= factor * t->matrix[pivot_row][j];
            }
        }
    }
    
    t->basis[pivot_row] = pivot_col;
}

Solution* simplex_solve(Food* foods, int num_foods, double* constraints, int num_constraints, int verbose) {
    int num_vars = num_foods;
    int num_slack = num_constraints;
    int total_cols = num_vars + num_slack + 1;
    int total_rows = num_constraints + 1;
    
    Tableau* t = create_tableau(total_rows, total_cols);
    
    for (int i = 0; i < num_constraints; i++) {
        for (int j = 0; j < num_foods; j++) {
            t->matrix[i][j] = -foods[j].nutrients[i];
        }
        t->matrix[i][num_vars + i] = -1.0;
        t->matrix[i][total_cols - 1] = -constraints[i];
        t->basis[i] = num_vars + i;
    }
    
    for (int j = 0; j < num_foods; j++) {
        t->matrix[total_rows - 1][j] = foods[j].cost;
    }
    
    if (verbose) {
        printf("\nInitial Tableau:\n");
        print_tableau(t);
    }
    
    int iteration = 0;
    int max_iterations = 100;
    
    while (iteration < max_iterations) {
        int pivot_col = find_pivot_column(t);
        
        if (pivot_col == -1) {
            if (verbose) printf("\nOptimal solution found!\n");
            break;
        }
        
        int pivot_row = find_pivot_row(t, pivot_col);
        
        if (pivot_row == -1) {
            if (verbose) printf("\nProblem is unbounded!\n");
            free_tableau(t);
            return NULL;
        }
        
        if (verbose) {
            printf("\nIteration %d: Pivot at row %d, column %d\n", iteration + 1, pivot_row, pivot_col);
        }
        
        pivot_operation(t, pivot_row, pivot_col);
        
        if (verbose) {
            print_tableau(t);
        }
        
        iteration++;
    }
    
    Solution* sol = (Solution*)malloc(sizeof(Solution));
    sol->amounts = (double*)calloc(num_foods, sizeof(double));
    sol->shadow_prices = (double*)calloc(num_constraints, sizeof(double));
    sol->feasible = 1;
    
    for (int j = 0; j < num_vars; j++) {
        int is_basic = 0;
        int basic_row = -1;
        
        for (int i = 0; i < num_constraints; i++) {
            if (fabs(t->matrix[i][j] - 1.0) < EPSILON) {
                int all_zero = 1;
                for (int k = 0; k < num_constraints; k++) {
                    if (k != i && fabs(t->matrix[k][j]) > EPSILON) {
                        all_zero = 0;
                        break;
                    }
                }
                if (all_zero) {
                    is_basic = 1;
                    basic_row = i;
                    break;
                }
            }
        }
        
        if (is_basic && basic_row >= 0) {
            sol->amounts[j] = fmax(0.0, t->matrix[basic_row][total_cols - 1]);
        }
    }
    
    sol->total_cost = 0.0;
    for (int j = 0; j < num_foods; j++) {
        sol->total_cost += sol->amounts[j] * foods[j].cost;
    }
    
    for (int i = 0; i < num_constraints; i++) {
        sol->shadow_prices[i] = fabs(t->matrix[total_rows - 1][num_vars + i]);
    }
    
    free_tableau(t);
    return sol;
}

void print_solution(Solution* sol, Food* foods, int num_foods, char** constraint_names, int num_constraints) {
    if (!sol || !sol->feasible) {
        printf("\nNo feasible solution found!\n");
        return;
    }
    
    printf("\n");
    printf("========================================\n");
    printf("      OPTIMAL DIET SOLUTION\n");
    printf("========================================\n");
    printf("\nMinimum Daily Cost: $%.2f\n", sol->total_cost);
    printf("\nFood Quantities:\n");
    printf("----------------------------------------\n");
    
    for (int i = 0; i < num_foods; i++) {
        if (sol->amounts[i] > EPSILON) {
            printf("%-20s: %8.2f units ($%.2f)\n", 
                   foods[i].name, 
                   sol->amounts[i], 
                   sol->amounts[i] * foods[i].cost);
        }
    }
    
    printf("\n========================================\n");
    printf("      SHADOW PRICES (Dual Values)\n");
    printf("========================================\n");
    printf("\nMarginal value of each constraint:\n");
    printf("----------------------------------------\n");
    
    for (int i = 0; i < num_constraints; i++) {
        printf("%-20s: $%.6f per unit\n", 
               constraint_names[i], 
               sol->shadow_prices[i]);
    }
    printf("\n");
}

void sensitivity_analysis(Solution* sol, Food* foods, int num_foods) {
    printf("\n========================================\n");
    printf("      SENSITIVITY ANALYSIS\n");
    printf("========================================\n");
    
    for (int i = 0; i < num_foods; i++) {
        if (sol->amounts[i] > EPSILON) {
            printf("\n%s (Current: $%.2f, Quantity: %.2f)\n", 
                   foods[i].name, foods[i].cost, sol->amounts[i]);
            printf("Price Change | New Price | Cost Impact\n");
            printf("----------------------------------------\n");
            
            for (int pct = -50; pct <= 50; pct += 10) {
                double new_price = foods[i].cost * (1.0 + pct / 100.0);
                double impact = sol->amounts[i] * (new_price - foods[i].cost);
                printf("%4d%%       | $%7.2f  | $%7.2f\n", pct, new_price, impact);
            }
        }
    }
    printf("\n");
}

int main(int argc, char** argv) {
    Food foods[] = {
        {"Oatmeal", 0.50, {5.0, 27.0, 3.0, 4.0, 15.0}},
        {"Chicken Breast", 3.00, {31.0, 0.0, 3.6, 0.0, 10.0}},
        {"Brown Rice", 0.30, {2.6, 23.0, 0.9, 1.8, 5.0}},
        {"Broccoli", 1.50, {2.8, 7.0, 0.4, 2.6, 135.0}},
        {"Banana", 0.25, {1.3, 27.0, 0.3, 3.1, 17.0}},
        {"Eggs", 2.00, {13.0, 1.1, 11.0, 0.0, 15.0}},
        {"Almonds", 4.50, {21.0, 22.0, 49.0, 12.0, 26.0}},
        {"Milk", 1.20, {8.0, 12.0, 8.0, 0.0, 50.0}}
    };
    
    int num_foods = sizeof(foods) / sizeof(foods[0]);
    
    double constraints[] = {50.0, 130.0, 44.0, 25.0, 100.0};
    int num_constraints = 5;
    
    char* constraint_names[] = {
        "Protein (g)",
        "Carbohydrates (g)",
        "Fat (g)",
        "Fiber (g)",
        "Vitamins (%DV)"
    };
    
    int verbose = (argc > 1 && strcmp(argv[1], "-v") == 0);
    
    printf("\n");
    printf("╔════════════════════════════════════════════════════════╗\n");
    printf("║  LINEAR PROGRAMMING: DIET OPTIMIZATION CALCULATOR      ║\n");
    printf("║  Classic 1945 Operations Research Problem              ║\n");
    printf("╚════════════════════════════════════════════════════════╝\n");
    
    printf("\nConstraints (Minimum Daily Requirements):\n");
    for (int i = 0; i < num_constraints; i++) {
        printf("  %s >= %.1f\n", constraint_names[i], constraints[i]);
    }
    
    printf("\nAvailable Foods:\n");
    for (int i = 0; i < num_foods; i++) {
        printf("  %-20s: $%.2f\n", foods[i].name, foods[i].cost);
    }
    
    Solution* sol = simplex_solve(foods, num_foods, constraints, num_constraints, verbose);
    
    if (sol) {
        print_solution(sol, foods, num_foods, constraint_names, num_constraints);
        sensitivity_analysis(sol, foods, num_foods);
        
        free(sol->amounts);
        free(sol->shadow_prices);
        free(sol);
    }
    
    return 0;
}