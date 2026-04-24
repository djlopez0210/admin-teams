
import random
from sqlalchemy import text

def sort_teams_by_ranking(teams_data):
    """
    Sorts teams based on the standard tie-breaking rules:
    1. Points
    2. Goal Difference
    3. Goals For
    """
    return sorted(
        teams_data, 
        key=lambda x: (x.get('points', 0), x.get('goals_for', 0) - x.get('goals_against', 0), x.get('goals_for', 0)), 
        reverse=True
    )

def advance_teams(teams, config):
    """
    Main entry point for advancing teams from one phase to the next.
    """
    if config["advancement_mode"] == "single_knockout":
        sorted_teams = sort_teams_by_ranking(teams)
        return {
            "main": sorted_teams[:config.get("qualified_count", 0)]
        }
    
    elif config["advancement_mode"] == "multi_cup":
        if config["qualification_type"] == "group_positions":
            return assign_by_group_positions(teams, config["rules"])
        elif config["qualification_type"] == "global_ranking":
            sorted_teams = sort_teams_by_ranking(teams)
            return assign_by_global_ranking(sorted_teams, config["rules"])
    
    return {}

def assign_by_global_ranking(teams, rules):
    """
    Assigns teams to different cups based on their global ranking position.
    Rules format: [{"from": 1, "to": 16, "target": "gold"}, ...]
    """
    result = {}
    for rule in rules:
        target = rule["target"]
        if target == "eliminated":
            continue
            
        start = rule["from"] - 1
        end = rule["to"]
        result[target] = teams[start:end]
    return result

def assign_by_group_positions(teams_by_group, rules):
    """
    Assigns teams based on their position within each group.
    teams_by_group: { "Group A": [team1, team2, ...], "Group B": [...] }
    rules format: { "1": "gold", "2": "gold", "3": "silver", "4": "bronze" }
    """
    result = {}
    for group_name, teams in teams_by_group.items():
        for i, team in enumerate(teams):
            pos = str(i + 1)
            target = rules.get(pos)
            if target and target != "eliminated":
                if target not in result:
                    result[target] = []
                result[target].append(team)
    return result

def generate_knockout_bracket(stage_config, teams):
    """
    Generates pairings for a knockout stage.
    """
    seeding_type = stage_config.get("seeding_type", "global_ranking")
    
    if seeding_type == "global_ranking":
        sorted_teams = sort_teams_by_ranking(teams)
        return seed_global_ranking(sorted_teams)
    
    elif seeding_type == "group_based":
        avoid_same_group = stage_config.get("seeding_options", {}).get("avoid_same_group", False)
        if avoid_same_group:
            return assign_with_constraints(teams, stage_config)
        else:
            return assign_standard_group_based(teams)
            
    elif seeding_type == "manual":
        # Manual seeding returns empty pairings to be filled by admin
        return []

def seed_global_ranking(teams):
    """
    Classic 1 vs N, 2 vs N-1 seeding.
    """
    n = len(teams)
    pairings = []
    for i in range(n // 2):
        pairings.append({
            "home": teams[i],
            "away": teams[n - 1 - i]
        })
    return pairings

def assign_standard_group_based(teams):
    """
    Standard A1 vs B2, B1 vs A2, etc. logic.
    Assumes teams have 'group_name' and 'position' info.
    """
    groups = {}
    for t in teams:
        gn = t.get('group_name', 'Unknown')
        if gn not in groups: groups[gn] = []
        groups[gn].append(t)
    
    group_names = sorted(groups.keys())
    pairings = []
    
    # Simple crossover: A1 vs B2, B1 vs A2, C1 vs D2, D1 vs C2...
    for i in range(0, len(group_names), 2):
        if i + 1 < len(group_names):
            g1 = group_names[i]
            g2 = group_names[i+1]
            
            # A1 vs B2
            t1_1 = next((t for t in groups[g1] if t.get('position') == 1), None)
            t2_2 = next((t for t in groups[g2] if t.get('position') == 2), None)
            if t1_1 and t2_2:
                pairings.append({"home": t1_1, "away": t2_2})
                
            # B1 vs A2
            t2_1 = next((t for t in groups[g2] if t.get('position') == 1), None)
            t1_2 = next((t for t in groups[g1] if t.get('position') == 2), None)
            if t2_1 and t1_2:
                pairings.append({"home": t2_1, "away": t1_2})
                
    return pairings

def assign_with_constraints(teams, config):
    """
    Attempts to seed while avoiding teams from the same group.
    Basic implementation: try standard crossover, if collision, shuffle.
    """
    # For now, let's implement a simpler version: 
    # Just ensure teams from same group don't meet in the first round.
    
    # 1. Separate by position
    pos1 = [t for t in teams if t.get('position') == 1]
    pos2 = [t for t in teams if t.get('position') == 2]
    
    random.shuffle(pos1)
    random.shuffle(pos2)
    
    pairings = []
    max_attempts = 100
    
    for _ in range(max_attempts):
        temp_pos2 = list(pos2)
        current_pairings = []
        success = True
        
        for t1 in pos1:
            # Find a t2 that is not from the same group
            possible_t2 = [t for t in temp_pos2 if t.get('group_id') != t1.get('group_id')]
            if not possible_t2:
                success = False
                break
            
            t2 = random.choice(possible_t2)
            current_pairings.append({"home": t1, "away": t2})
            temp_pos2.remove(t2)
            
        if success:
            return current_pairings
            
    # Fallback to standard if constraints are impossible
    return seed_global_ranking(teams)
