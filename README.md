# Dynamic Menu - Hugo Static Site

A dynamic restaurant menu website built with Hugo (Go-based static site generator) that can be deployed to GitHub Pages.

## Project Overview

This project creates a beautiful, responsive restaurant menu website with:
- Food items organized by categories (Appetizers, Main Courses, Desserts, Beverages, etc.)
- Sample food data with descriptions and prices
- Dynamic menu display with filtering capabilities
- GitHub Pages deployment ready

## Project Structure

```
demenu-site/
├── README.md                 # This file
├── hugo.toml                 # Hugo configuration
├── .gitignore              # Git ignore rules
├── .github/
│   └── workflows/
│       └── gh-pages.yml    # GitHub Actions workflow for deployment
├── content/
│   ├── _index.md           # Home page
│   └── menu/
│       └── _index.md       # Menu page
├── data/
│   └── menu.json           # Menu data (categories and food items)
├── static/
│   ├── css/
│   │   └── custom.css      # Custom styles
│   └── js/
│       └── menu.js         # Menu filtering/interaction logic
├── themes/                  # Hugo themes (if using a theme)
└── layouts/
    ├── _default/
    │   ├── baseof.html     # Base template
    │   ├── list.html       # List template
    │   └── single.html     # Single page template
    └── partials/
        ├── header.html     # Header partial
        ├── footer.html     # Footer partial
        └── menu.html       # Menu display partial
```

## GitHub Pages Deployment

The GitHub Actions workflow automatically:
- Builds the Hugo site
- Deploys to GitHub Pages
- Makes your site available at `https://YOUR_USERNAME.github.io/demenu-site/`

**To enable GitHub Pages:**
1. Go to your repository Settings → Pages
2. Source: Select "GitHub Actions"

## Development Workflow

1. **Make changes to content/data:**
   - Edit `data/menu.json` to update menu items
   - Edit `content/` files for pages
   - Edit `layouts/` for template changes

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Update menu items"
   git push
   ```

## Menu Data Structure

The menu data is stored in `data/menu.json` with the following structure:

```json
{
  "categories": [
    {
      "id": "appetizers",
      "name": "Appetizers",
      "description": "Category description",
      "items": [
        {
          "name": "Item Name",
          "description": "Item description",
          "price": 9.99,
          "dietary": "Vegetarian",
          "spicy": "Mild",
          "size": "Regular",
          "image": "/images/item.jpg"
        }
      ]
    }
  ]
}
```

## Reusable Meal Component

The project includes a reusable meal component (`layouts/partials/meal.html`) that can be used to display menu items consistently throughout the site.

### Usage

**Basic usage with menu data:**
```go
{{ range .items }}
    {{ partial "meal.html" . }}
{{ end }}
```

**With custom parameters:**
```go
{{ partial "meal.html" (dict 
    "name" "Grilled Salmon" 
    "price" 24.99 
    "description" "Fresh Atlantic salmon"
    "dietary" "Gluten-Free"
    "image" "/images/salmon.jpg"
) }}
```

### Available Parameters

- **name** (required): Name of the meal/item
- **price** (required): Price of the meal (number)
- **description** (optional): Description of the meal
- **image** (optional): URL to an image of the meal
- **dietary** (optional): Dietary information badge (e.g., "Vegetarian", "Gluten-Free", "Vegan")
- **spicy** (optional): Spice level badge (e.g., "Mild", "Medium", "Hot")
- **size** (optional): Size options (e.g., "Small", "Medium", "Large")

The component automatically handles all optional fields and displays them only when provided.

## Customization

- **Styling:** Edit `static/css/custom.css`
- **Menu Logic:** Edit `static/js/menu.js`
- **Templates:** Edit files in `layouts/`
- **Menu Data:** Edit `data/menu.json`

## License

This project is open source and available for personal or commercial use.
