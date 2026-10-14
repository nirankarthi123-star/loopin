import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Image as ImageIcon,
} from "lucide-react";
import { createItem } from "@/services/index.ts";
import type { ItemCategory, ItemCondition } from "@loopin/shared";
import { ITEM_CATEGORIES, ITEM_CONDITIONS } from "@loopin/shared";
import { FormField, ErrorMessage } from "@/components/ui/shared.tsx";

const SAMPLE_IMAGES = [
  { label: "Electronics / Hardware", url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600" },
  { label: "Camera / Lens", url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600" },
  { label: "Calculator / Math", url: "https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=600" },
  { label: "Textbook / Study", url: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600" },
  { label: "Tools / Repair", url: "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600" },
];

export function ListItemPage() {
  const navigate = useNavigate();

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ItemCategory>("electronics");
  const [condition, setCondition] = useState<ItemCondition>("good");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdItemId, setCreatedItemId] = useState<string | null>(null);

  // Validation errors
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = () => {
    const newErrors: { [key: string]: string } = {};

    if (!title.trim()) {
      newErrors["title"] = "Title is required.";
    } else if (title.trim().length < 3) {
      newErrors["title"] = "Title must be at least 3 characters.";
    }

    if (!description.trim()) {
      newErrors["description"] = "Description is required.";
    } else if (description.trim().length < 10) {
      newErrors["description"] = "Please provide at least 10 characters describing the item.";
    }

    const val = Number(estimatedValue);
    if (!estimatedValue || isNaN(val) || val <= 0) {
      newErrors["estimatedValue"] = "Please enter a valid replacement value greater than 0.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const newItem = await createItem({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        estimatedValue: Number(estimatedValue),
        tags: tags.length > 0 ? tags : [category],
        ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      });

      setCreatedItemId(newItem.itemId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list item.");
    } finally {
      setSubmitting(false);
    }
  };

  if (createdItemId) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center animate-slide-up">
        <div className="card space-y-5 p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ink">Item Listed Successfully!</h1>
            <p className="mt-2 text-sm text-ink-muted leading-relaxed">
              &ldquo;{title}&rdquo; is now live on the campus loop. Your fellow VIT Chennai students can now request to borrow it.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setCreatedItemId(null);
                setTitle("");
                setDescription("");
                setEstimatedValue("");
                setImageUrl("");
                setTagsInput("");
              }}
              className="btn-secondary flex-1 justify-center text-sm"
            >
              List Another Item
            </button>
            <Link
              to={`/items/${createdItemId}`}
              className="btn-primary flex-1 justify-center text-sm shadow-brand"
            >
              View Item Listing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-slide-up pb-12">
      <div>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Explore
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">List an Item on LoopIn</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Lend tools, gear, or books you own to peers and build your campus TrustScore.
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        {error && (
          <div className="mb-6">
            <ErrorMessage message={error} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6" noValidate>
          {/* Title */}
          <FormField
            label="Item Title"
            htmlFor="item-title"
            required
            error={errors["title"]}
            hint="Be specific (e.g., 'Arduino Starter Kit with Breadboard')"
          >
            <input
              id="item-title"
              type="text"
              className="input"
              placeholder="e.g. Sony WH-1000XM4 Noise Cancelling Headphones"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors["title"]) setErrors((prev) => ({ ...prev, title: "" }));
              }}
              maxLength={80}
            />
          </FormField>

          {/* Category & Condition Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Category" htmlFor="item-category" required>
              <select
                id="item-category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ItemCategory)}
              >
                {Object.entries(ITEM_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Condition" htmlFor="item-condition" required>
              <select
                id="item-condition"
                className="input"
                value={condition}
                onChange={(e) => setCondition(e.target.value as ItemCondition)}
              >
                {Object.entries(ITEM_CONDITIONS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Description */}
          <FormField
            label="Description & Instructions"
            htmlFor="item-description"
            required
            error={errors["description"]}
            hint="Include what's included (cables, manuals), pickup location preferences, etc."
          >
            <textarea
              id="item-description"
              rows={4}
              className="input"
              placeholder="Working condition. Includes USB-C charging cable and case. Available for pickup outside Himalaya Mess or Central Library."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors["description"]) setErrors((prev) => ({ ...prev, description: "" }));
              }}
              maxLength={500}
            />
          </FormField>

          {/* Estimated Value */}
          <FormField
            label="Estimated Replacement Value (₹ INR)"
            htmlFor="item-value"
            required
            error={errors["estimatedValue"]}
            hint="Helps calculate campus money saved by the community."
          >
            <input
              id="item-value"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 150"
              className="input"
              value={estimatedValue}
              onChange={(e) => {
                setEstimatedValue(e.target.value);
                if (errors["estimatedValue"]) setErrors((prev) => ({ ...prev, estimatedValue: "" }));
              }}
            />
          </FormField>

          {/* Image URL & sample picker */}
          <FormField
            label="Photo URL (Optional)"
            htmlFor="item-image"
            hint="Paste an image URL or choose one of the sample campus presets below."
          >
            <div className="space-y-3">
              <input
                id="item-image"
                type="url"
                className="input"
                placeholder="https://images.unsplash.com/..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-ink-subtle flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Sample presets:
                </span>
                {SAMPLE_IMAGES.map((img) => (
                  <button
                    key={img.label}
                    type="button"
                    onClick={() => setImageUrl(img.url)}
                    className="rounded-lg border border-surface-border bg-surface-muted px-2.5 py-1 text-ink-muted hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  >
                    {img.label}
                  </button>
                ))}
              </div>
            </div>
          </FormField>

          {/* Tags */}
          <FormField
            label="Tags (Optional)"
            htmlFor="item-tags"
            hint="Comma separated (e.g., 'robotics, lab, sensors, exam')"
          >
            <input
              id="item-tags"
              type="text"
              className="input"
              placeholder="electronics, lab, course-cs3000"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </FormField>

          <div className="rounded-xl border border-surface-border bg-surface-muted p-4 text-xs text-ink-muted flex items-start gap-2.5">
            <Info className="h-4 w-4 text-brand-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-ink">Campus Community Pledge</p>
              <p className="mt-0.5 leading-relaxed">
                By listing, you agree to inspect items before and after lending. You retain 100% ownership of your item at all times.
              </p>
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary flex-1 justify-center"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 justify-center shadow-brand"
              disabled={submitting}
            >
              {submitting ? "Publishing Listing..." : "List Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
