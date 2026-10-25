import { describe, expect, it } from "vitest";
import { stringArgType } from "./pythonHelp";

describe("what goes in the quotes", () => {
  it("reads the parameter type from the catalog, counting commas", () => {
    expect(stringArgType('place_meeting(self.x + 4, y, "')).toBe("object");
    expect(stringArgType('keyboard_check("le')).toBe("key");
    expect(stringArgType('self.sprite = "')).toBeNull();
    expect(stringArgType('draw_sprite("pl')).toBe("sprite");
    expect(stringArgType('room_goto("')).toBe("room");
    expect(stringArgType('if keyboard_check("a") and place_meeting(max(x, 1), y, \'')).toBe("object");
  });
});
