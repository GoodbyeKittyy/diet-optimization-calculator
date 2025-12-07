-- PostgreSQL Database Schema for Diet Optimization Calculator
-- This schema supports storing food items, constraints, and optimization results

-- Create database (run separately as superuser)
-- CREATE DATABASE diet_optimizer;

-- Connect to the database
-- \c diet_optimizer;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: foods
-- Stores the food database with nutritional information
CREATE TABLE foods (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    cost DECIMAL(10, 2) NOT NULL CHECK (cost >= 0),
    protein DECIMAL(10, 2) NOT NULL CHECK (protein >= 0),
    carbohydrates DECIMAL(10, 2) NOT NULL CHECK (carbohydrates >= 0),
    fat DECIMAL(10, 2) NOT NULL CHECK (fat >= 0),
    fiber DECIMAL(10, 2) NOT NULL CHECK (fiber >= 0),
    vitamins DECIMAL(10, 2) NOT NULL CHECK (vitamins >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Table: constraints
-- Stores nutritional constraint sets (minimum daily requirements)
CREATE TABLE constraints (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    protein_min DECIMAL(10, 2) NOT NULL CHECK (protein_min >= 0),
    carbohydrates_min DECIMAL(10, 2) NOT NULL CHECK (carbohydrates_min >= 0),
    fat_min DECIMAL(10, 2) NOT NULL CHECK (fat_min >= 0),
    fiber_min DECIMAL(10, 2) NOT NULL CHECK (fiber_min >= 0),
    vitamins_min DECIMAL(10, 2) NOT NULL CHECK (vitamins_min >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Table: optimization_runs
-- Stores results from each optimization run
CREATE TABLE optimization_runs (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    constraint_id INTEGER REFERENCES constraints(id) ON DELETE SET NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    feasible BOOLEAN NOT NULL,
    iteration_count INTEGER,
    computation_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: solution_items
-- Stores individual food quantities in each solution
CREATE TABLE solution_items (
    id SERIAL PRIMARY KEY,
    optimization_run_id INTEGER REFERENCES optimization_runs(id) ON DELETE CASCADE,
    food_id INTEGER REFERENCES foods(id) ON DELETE CASCADE,
    quantity DECIMAL(10, 4) NOT NULL CHECK (quantity >= 0),
    cost DECIMAL(10, 2) NOT NULL,
    UNIQUE(optimization_run_id, food_id)
);

-- Table: shadow_prices
-- Stores dual values (shadow prices) for each constraint
CREATE TABLE shadow_prices (
    id SERIAL PRIMARY KEY,
    optimization_run_id INTEGER REFERENCES optimization_runs(id) ON DELETE CASCADE,
    nutrient_name VARCHAR(50) NOT NULL,
    shadow_price DECIMAL(12, 6) NOT NULL,
    interpretation TEXT
);

-- Table: tableau_snapshots
-- Stores simplex tableau states for visualization
CREATE TABLE tableau_snapshots (
    id SERIAL PRIMARY KEY,
    optimization_run_id INTEGER REFERENCES optimization_runs(id) ON DELETE CASCADE,
    iteration INTEGER NOT NULL,
    tableau_data JSONB NOT NULL,
    pivot_row INTEGER,
    pivot_col INTEGER
);

-- Indexes for performance
CREATE INDEX idx_foods_active ON foods(active);
CREATE INDEX idx_foods_name ON foods(name);
CREATE INDEX idx_constraints_active ON constraints(active);
CREATE INDEX idx_optimization_runs_created ON optimization_runs(created_at DESC);
CREATE INDEX idx_solution_items_run ON solution_items(optimization_run_id);
CREATE INDEX idx_shadow_prices_run ON shadow_prices(optimization_run_id);
CREATE INDEX idx_tableau_snapshots_run ON tableau_snapshots(optimization_run_id, iteration);

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_foods_updated_at BEFORE UPDATE ON foods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_constraints_updated_at BEFORE UPDATE ON constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample food data
INSERT INTO foods (name, cost, protein, carbohydrates, fat, fiber, vitamins) VALUES
    ('Oatmeal', 0.50, 5.0, 27.0, 3.0, 4.0, 15.0),
    ('Chicken Breast', 3.00, 31.0, 0.0, 3.6, 0.0, 10.0),
    ('Brown Rice', 0.30, 2.6, 23.0, 0.9, 1.8, 5.0),
    ('Broccoli', 1.50, 2.8, 7.0, 0.4, 2.6, 135.0),
    ('Banana', 0.25, 1.3, 27.0, 0.3, 3.1, 17.0),
    ('Eggs', 2.00, 13.0, 1.1, 11.0, 0.0, 15.0),
    ('Almonds', 4.50, 21.0, 22.0, 49.0, 12.0, 26.0),
    ('Milk', 1.20, 8.0, 12.0, 8.0, 0.0, 50.0),
    ('Spinach', 2.00, 2.9, 3.6, 0.4, 2.2, 188.0),
    ('Sweet Potato', 0.80, 1.6, 20.0, 0.1, 3.0, 384.0);

-- Insert sample constraint sets
INSERT INTO constraints (name, description, protein_min, carbohydrates_min, fat_min, fiber_min, vitamins_min) VALUES
    ('Standard Adult', 'USDA recommended daily allowances for average adult', 50.0, 130.0, 44.0, 25.0, 100.0),
    ('High Protein', 'High protein diet for athletes', 100.0, 100.0, 40.0, 30.0, 100.0),
    ('Low Carb', 'Low carbohydrate diet', 75.0, 50.0, 70.0, 25.0, 100.0),
    ('Balanced', 'Balanced macronutrient distribution', 60.0, 150.0, 50.0, 30.0, 120.0);

-- View: Current food prices with nutritional density
CREATE OR REPLACE VIEW food_nutrition_density AS
SELECT 
    f.id,
    f.name,
    f.cost,
    f.protein,
    f.carbohydrates,
    f.fat,
    f.fiber,
    f.vitamins,
    ROUND((f.protein + f.carbohydrates + f.fat + f.fiber + f.vitamins) / NULLIF(f.cost, 0), 2) AS nutrition_per_dollar,
    ROUND(f.protein / NULLIF(f.cost, 0), 2) AS protein_per_dollar
FROM foods f
WHERE f.active = TRUE
ORDER BY nutrition_per_dollar DESC;

-- View: Optimization run summary
CREATE OR REPLACE VIEW optimization_summary AS
SELECT 
    r.id,
    r.uuid,
    c.name AS constraint_set,
    r.total_cost,
    r.feasible,
    r.iteration_count,
    r.computation_time_ms,
    COUNT(si.id) AS food_count,
    r.created_at
FROM optimization_runs r
LEFT JOIN constraints c ON r.constraint_id = c.id
LEFT JOIN solution_items si ON r.id = si.optimization_run_id
GROUP BY r.id, r.uuid, c.name, r.total_cost, r.feasible, r.iteration_count, r.computation_time_ms, r.created_at
ORDER BY r.created_at DESC;

-- Stored Procedure: Save optimization result
CREATE OR REPLACE FUNCTION save_optimization_result(
    p_constraint_id INTEGER,
    p_total_cost DECIMAL,
    p_feasible BOOLEAN,
    p_iteration_count INTEGER,
    p_computation_time_ms INTEGER,
    p_solution_items JSONB,
    p_shadow_prices JSONB
) RETURNS INTEGER AS $$
DECLARE
    v_run_id INTEGER;
    v_item JSONB;
    v_shadow JSONB;
BEGIN
    -- Insert optimization run
    INSERT INTO optimization_runs (constraint_id, total_cost, feasible, iteration_count, computation_time_ms)
    VALUES (p_constraint_id, p_total_cost, p_feasible, p_iteration_count, p_computation_time_ms)
    RETURNING id INTO v_run_id;
    
    -- Insert solution items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_solution_items)
    LOOP
        INSERT INTO solution_items (optimization_run_id, food_id, quantity, cost)
        VALUES (
            v_run_id,
            (v_item->>'food_id')::INTEGER,
            (v_item->>'quantity')::DECIMAL,
            (v_item->>'cost')::DECIMAL
        );
    END LOOP;
    
    -- Insert shadow prices
    FOR v_shadow IN SELECT * FROM jsonb_array_elements(p_shadow_prices)
    LOOP
        INSERT INTO shadow_prices (optimization_run_id, nutrient_name, shadow_price, interpretation)
        VALUES (
            v_run_id,
            v_shadow->>'nutrient_name',
            (v_shadow->>'shadow_price')::DECIMAL,
            v_shadow->>'interpretation'
        );
    END LOOP;
    
    RETURN v_run_id;
END;
$$ LANGUAGE plpgsql;

-- Stored Procedure: Get optimal diet for constraint set
CREATE OR REPLACE FUNCTION get_optimal_diet(p_constraint_id INTEGER)
RETURNS TABLE (
    food_name VARCHAR,
    quantity DECIMAL,
    cost DECIMAL,
    total_protein DECIMAL,
    total_carbs DECIMAL,
    total_fat DECIMAL,
    total_fiber DECIMAL,
    total_vitamins DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.name,
        si.quantity,
        si.cost,
        ROUND(si.quantity * f.protein, 2) AS total_protein,
        ROUND(si.quantity * f.carbohydrates, 2) AS total_carbs,
        ROUND(si.quantity * f.fat, 2) AS total_fat,
        ROUND(si.quantity * f.fiber, 2) AS total_fiber,
        ROUND(si.quantity * f.vitamins, 2) AS total_vitamins
    FROM optimization_runs r
    JOIN solution_items si ON r.id = si.optimization_run_id
    JOIN foods f ON si.food_id = f.id
    WHERE r.constraint_id = p_constraint_id
        AND r.feasible = TRUE
    ORDER BY r.created_at DESC, si.cost DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate nutritional adequacy
CREATE OR REPLACE FUNCTION calculate_nutritional_adequacy(p_run_id INTEGER)
RETURNS TABLE (
    nutrient VARCHAR,
    required DECIMAL,
    provided DECIMAL,
    adequacy_pct DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH solution_nutrients AS (
        SELECT 
            SUM(si.quantity * f.protein) AS total_protein,
            SUM(si.quantity * f.carbohydrates) AS total_carbs,
            SUM(si.quantity * f.fat) AS total_fat,
            SUM(si.quantity * f.fiber) AS total_fiber,
            SUM(si.quantity * f.vitamins) AS total_vitamins
        FROM solution_items si
        JOIN foods f ON si.food_id = f.id
        WHERE si.optimization_run_id = p_run_id
    ),
    constraints_data AS (
        SELECT 
            c.protein_min,
            c.carbohydrates_min,
            c.fat_min,
            c.fiber_min,
            c.vitamins_min
        FROM optimization_runs r
        JOIN constraints c ON r.constraint_id = c.id
        WHERE r.id = p_run_id
    )
    SELECT 'Protein'::VARCHAR, cd.protein_min, sn.total_protein, 
           ROUND((sn.total_protein / NULLIF(cd.protein_min, 0)) * 100, 2)
    FROM solution_nutrients sn, constraints_data cd
    UNION ALL
    SELECT 'Carbohydrates', cd.carbohydrates_min, sn.total_carbs,
           ROUND((sn.total_carbs / NULLIF(cd.carbohydrates_min, 0)) * 100, 2)
    FROM solution_nutrients sn, constraints_data cd
    UNION ALL
    SELECT 'Fat', cd.fat_min, sn.total_fat,
           ROUND((sn.total_fat / NULLIF(cd.fat_min, 0)) * 100, 2)
    FROM solution_nutrients sn, constraints_data cd
    UNION ALL
    SELECT 'Fiber', cd.fiber_min, sn.total_fiber,
           ROUND((sn.total_fiber / NULLIF(cd.fiber_min, 0)) * 100, 2)
    FROM solution_nutrients sn, constraints_data cd
    UNION ALL
    SELECT 'Vitamins', cd.vitamins_min, sn.total_vitamins,
           ROUND((sn.total_vitamins / NULLIF(cd.vitamins_min, 0)) * 100, 2)
    FROM solution_nutrients sn, constraints_data cd;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust as needed for your users)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO your_user;

-- Comments for documentation
COMMENT ON TABLE foods IS 'Stores food items with their cost and nutritional information per unit';
COMMENT ON TABLE constraints IS 'Stores constraint sets representing different dietary requirements';
COMMENT ON TABLE optimization_runs IS 'Records of each optimization execution';
COMMENT ON TABLE solution_items IS 'Optimal quantities of each food in a solution';
COMMENT ON TABLE shadow_prices IS 'Dual values indicating marginal value of each constraint';
COMMENT ON TABLE tableau_snapshots IS 'Simplex algorithm tableau states for visualization';
COMMENT ON FUNCTION save_optimization_result IS 'Saves a complete optimization result including solution and shadow prices';
COMMENT ON FUNCTION get_optimal_diet IS 'Retrieves the optimal diet for a given constraint set';
COMMENT ON FUNCTION calculate_nutritional_adequacy IS 'Calculates how well a solution meets nutritional requirements';